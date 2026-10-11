"""Hypothetical impulsive-manoeuvre comparison (simulation only).

This module never produces commands and never labels an option as safe or
recommended. It compares a baseline and an alternative trajectory computed
with the *same* force model so that differences are attributable to the
hypothetical Δv, and it reports how far that model departs from the source
propagator (``model_divergence_km``) so the analyst can judge relevance.

Model: both objects' states at the burn epoch are taken from their source
propagators (SGP4 or ephemeris), converted to GCRF, and integrated with the
two-body + J2 model (J2 about the GCRF z-axis — an approximation whose
pole-direction error is ~0.4° in 2025; see MODEL_AND_DATA_LIMITATIONS.md).
The impulsive Δv is specified in the primary's RTN frame at the burn epoch.
"""

from __future__ import annotations

import math
from dataclasses import dataclass, field

import numpy as np
from astropy.time import Time, TimeDelta
from scipy.optimize import minimize_scalar

from .. import ALGORITHM_VERSIONS
from .encounter import geometry
from .frames import Frame, convert, rtn_basis
from .propagation import J2Propagator, Propagator
from .screening import ScreeningConfig, screen
from .timeutil import iso_utc

G0 = 9.80665e-3  # km/s^2


@dataclass
class ManeuverSpec:
    burn_time: Time
    dv_rtn_m_s: tuple[float, float, float]
    search_half_window_s: float = 1800.0
    spacecraft_mass_kg: float | None = None
    isp_s: float | None = None


@dataclass
class ArmResult:
    tca: Time | None
    miss_km: float | None
    rel_speed_km_s: float | None
    geometry: dict | None

    def to_dict(self) -> dict:
        return {
            "tca_utc": iso_utc(self.tca) if self.tca is not None else None,
            "miss_km": self.miss_km,
            "rel_speed_km_s": self.rel_speed_km_s,
            "geometry": self.geometry,
        }


@dataclass
class ManeuverResult:
    baseline: ArmResult
    alternative: ArmResult
    dv_magnitude_m_s: float
    propellant_kg: float | None
    model_divergence_km: dict
    other_encounters: list[dict]
    warnings: list[str] = field(default_factory=list)
    model: str = J2Propagator.method
    algorithm: str = ALGORITHM_VERSIONS["maneuver_sim"]

    def to_dict(self) -> dict:
        return {
            "label": "SIMULATION ONLY — decision support requiring independent expert review",
            "baseline": self.baseline.to_dict(),
            "alternative": self.alternative.to_dict(),
            "miss_change_km": (self.alternative.miss_km - self.baseline.miss_km)
            if self.alternative.miss_km is not None and self.baseline.miss_km is not None else None,
            "dv_magnitude_m_s": self.dv_magnitude_m_s,
            "propellant_kg": self.propellant_kg,
            "model_divergence_km": self.model_divergence_km,
            "other_encounters": self.other_encounters,
            "warnings": self.warnings,
            "model": self.model,
            "algorithm": self.algorithm,
        }


def _state_gcrf(p: Propagator, t: Time) -> tuple[np.ndarray, np.ndarray]:
    res = p.propagate(t, np.array([0.0]))
    if not res.valid[0]:
        raise ValueError(f"{p.object_id}: no valid state at {iso_utc(t)}")
    r, v = convert(res.r_km, res.v_km_s, res.frame, Frame.GCRF, t)
    return r[0], v[0]


def _closest(pa: Propagator, pb: Propagator, centre: Time, half: float) -> ArmResult:
    grid = np.linspace(-half, half, int(2 * half / 10) + 1)
    ra = pa.propagate(centre, grid)
    rb = pb.propagate(centre, grid)
    ok = ra.valid & rb.valid
    if not ok.any():
        return ArmResult(None, None, None, None)
    d = np.where(ok, np.linalg.norm(rb.r_km - ra.r_km, axis=1), np.inf)
    j = int(np.argmin(d))
    lo, hi = grid[max(j - 1, 0)], grid[min(j + 1, len(grid) - 1)]

    def dist(t: float) -> float:
        a = pa.propagate(centre, np.array([t]))
        b = pb.propagate(centre, np.array([t]))
        return float(np.linalg.norm(b.r_km[0] - a.r_km[0]))

    opt = minimize_scalar(dist, bounds=(lo, hi), method="bounded", options={"xatol": 1e-4})
    t = float(opt.x)
    a = pa.propagate(centre, np.array([t]))
    b = pb.propagate(centre, np.array([t]))
    g = geometry(a.r_km[0], a.v_km_s[0], b.r_km[0], b.v_km_s[0])
    return ArmResult(centre + TimeDelta(t, format="sec"), g.miss_km, g.rel_speed_km_s, g.to_dict())


def simulate(
    primary: Propagator,
    secondary: Propagator,
    tca: Time,
    spec: ManeuverSpec,
    others: dict[str, Propagator] | None = None,
    screen_threshold_km: float = 5.0,
) -> ManeuverResult:
    lead = (tca - spec.burn_time).sec
    if lead <= 0:
        raise ValueError("burn must occur before TCA")
    if lead > 7 * 86400:
        raise ValueError("burn more than 7 days before TCA is outside the supported simulation span")
    warnings = []
    r1, v1 = _state_gcrf(primary, spec.burn_time)
    r2, v2 = _state_gcrf(secondary, spec.burn_time)
    base1 = J2Propagator(primary.object_id, spec.burn_time, r1, v1, Frame.GCRF)
    base2 = J2Propagator(secondary.object_id, spec.burn_time, r2, v2, Frame.GCRF)
    dv_rtn = np.asarray(spec.dv_rtn_m_s, float) / 1000.0
    dv_inertial = rtn_basis(r1, v1).T @ dv_rtn
    alt1 = J2Propagator(primary.object_id, spec.burn_time, r1, v1 + dv_inertial, Frame.GCRF)

    baseline = _closest(base1, base2, tca, spec.search_half_window_s)
    alternative = _closest(alt1, base2, tca, spec.search_half_window_s)

    # Divergence of the scenario model from the source propagators at TCA.
    div = {}
    for name, src, j2 in (("primary", primary, base1), ("secondary", secondary, base2)):
        try:
            rs, _ = _state_gcrf(src, tca)
            rj = j2.propagate(tca, np.array([0.0])).r_km[0]
            div[name] = float(np.linalg.norm(rs - rj))
        except ValueError:
            div[name] = None
    if any(v is not None and v > 1.0 for v in div.values()):
        warnings.append("J2 scenario model departs from the source propagator by more than 1 km at TCA; absolute miss distances are model-dependent, compare baseline vs alternative only")
    if baseline.tca is not None and abs((baseline.tca - tca).sec) > 60:
        warnings.append("scenario-model baseline TCA differs from screening TCA by more than 60 s")

    dv_mag = float(np.linalg.norm(dv_rtn) * 1000.0)
    prop = None
    if spec.spacecraft_mass_kg and spec.isp_s:
        prop = float(spec.spacecraft_mass_kg * (1 - math.exp(-np.linalg.norm(dv_rtn) / (spec.isp_s * G0))))
    else:
        warnings.append("propellant not estimated: spacecraft mass and Isp not supplied")

    other_enc: list[dict] = []
    if others:
        props = {k: v for k, v in others.items() if k != primary.object_id}
        props[primary.object_id] = alt1
        cfg = ScreeningConfig(start=spec.burn_time, duration_s=lead + spec.search_half_window_s, step_s=10.0,
                              threshold_km=screen_threshold_km, primary_ids=[primary.object_id])
        try:
            res = screen(props, cfg)
            for e in res.encounters:
                if secondary.object_id in (e.primary, e.secondary):
                    continue  # the encounter under study is reported in the arms above
                other_enc.append(e.to_dict())
            if res.warnings:
                warnings.extend(f"secondary screening: {w}" for w in res.warnings[:5])
        except Exception as exc:  # report, never hide, a failed side-screen
            warnings.append(f"post-manoeuvre screening against other objects failed: {exc}")
    else:
        warnings.append("other objects not screened against the alternative trajectory; broader consequences unassessed")
    warnings.append("uncertainty not propagated: miss-distance changes are nominal only")
    return ManeuverResult(baseline, alternative, dv_mag, prop, div, other_enc, warnings)
