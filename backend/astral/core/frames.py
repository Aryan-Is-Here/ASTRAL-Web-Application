"""Reference frames and transformations.

Supported frames
----------------
TEME     True Equator Mean Equinox of date — native output frame of SGP4.
GCRF     Geocentric Celestial Reference Frame (astropy ``GCRS`` for a
         geocentric object). Common frame used when inputs are mixed.
EME2000  Mean equator and equinox of J2000.0. Related to GCRF by the constant
         IAU 2000 frame-bias rotation (ERFA ``bp00``), ~23 mas.
ITRF     International Terrestrial Reference Frame (astropy ``ITRS``),
         using the IERS data bundled with astropy.

TEME/ITRF conversions use astropy's IAU 2006/2000A implementation. They are
checked against the published Vallado et al. (2006) TEME->ITRF example in
``tests/reference``.

Distances and relative speeds between two objects expressed in the *same*
inertial frame at the *same* instant are invariant under rotation, so a
catalogue in which every object is TEME can be screened in TEME directly.
Mixed-frame catalogues are converted to GCRF first.
"""

from __future__ import annotations

from enum import Enum

import astropy.units as u
import erfa
import numpy as np
from astropy.coordinates import GCRS, ITRS, TEME, CartesianDifferential, CartesianRepresentation
from astropy.time import Time
from astropy.utils import iers

# Earth-orientation parameters (UT1-UTC, polar motion) come from the IERS-B
# table bundled with astropy; ASTRAL never downloads EOP data at run time.
# Outside the table, astropy assumes UT1-UTC = 0 and mean polar motion. This
# affects only conversions involving ITRF (Earth-fixed): up to ~0.9 s of
# Earth rotation, i.e. up to ~0.5 km along-track for LEO positions. TEME<->GCRF
# conversions do not depend on UT1 (the Earth-rotation terms cancel).
iers.conf.iers_degraded_accuracy = "ignore"


def eop_table_end() -> Time:
    t = iers.earth_orientation_table.get()
    return Time(t["MJD"][-1], format="mjd", scale="utc")


def eop_covered(t: Time) -> bool:
    try:
        return bool(Time(t).utc.max() <= eop_table_end())
    except Exception:
        return False


def earth_rotation_angle_deg(t: Time) -> tuple[float, bool]:
    """Earth Rotation Angle (IAU 2000) in degrees and whether real UT1 was used."""
    if eop_covered(t):
        u = t.ut1
        return float(np.degrees(erfa.era00(u.jd1, u.jd2)) % 360), True
    u = t.utc
    return float(np.degrees(erfa.era00(u.jd1, u.jd2)) % 360), False


class Frame(str, Enum):
    TEME = "TEME"
    GCRF = "GCRF"
    EME2000 = "EME2000"
    ITRF = "ITRF"


FRAME_ALIASES = {
    "TEME": Frame.TEME,
    "GCRF": Frame.GCRF,
    "GCRS": Frame.GCRF,
    "ICRF": Frame.GCRF,  # geocentric ICRF axes; documented assumption in DATA_FORMATS.md
    "EME2000": Frame.EME2000,
    "J2000": Frame.EME2000,
    "ITRF": Frame.ITRF,
    "ITRF2000": Frame.ITRF,
    "ITRF2008": Frame.ITRF,
    "ITRF2014": Frame.ITRF,
    "ITRF2020": Frame.ITRF,
    "ITRF-93": Frame.ITRF,
    "ITRF-97": Frame.ITRF,
}

INERTIAL = {Frame.TEME, Frame.GCRF, Frame.EME2000}


class FrameError(ValueError):
    pass


def parse_frame(name: str) -> Frame:
    key = name.strip().upper()
    if key not in FRAME_ALIASES:
        raise FrameError(f"unsupported reference frame {name!r}")
    return FRAME_ALIASES[key]


def _frame_bias() -> np.ndarray:
    # erfa.bp00 returns (rb, rp, rbp); rb maps GCRS -> mean J2000.
    rb, _rp, _rbp = erfa.bp00(2451545.0, 0.0)
    return np.asarray(rb)


_RB = _frame_bias()


def _rep(r: np.ndarray, v: np.ndarray) -> CartesianRepresentation:
    rep = CartesianRepresentation(r.T * u.km)
    return rep.with_differentials(CartesianDifferential(v.T * u.km / u.s))


def _unpack(coord) -> tuple[np.ndarray, np.ndarray]:
    r = coord.cartesian.xyz.to_value(u.km).T
    v = coord.velocity.d_xyz.to_value(u.km / u.s).T
    return np.atleast_2d(r), np.atleast_2d(v)


def to_gcrf(r: np.ndarray, v: np.ndarray, frame: Frame, times: Time) -> tuple[np.ndarray, np.ndarray]:
    """Convert (N,3) position/velocity arrays at N instants to GCRF."""
    r = np.atleast_2d(np.asarray(r, dtype=float))
    v = np.atleast_2d(np.asarray(v, dtype=float))
    if frame is Frame.GCRF:
        return r.copy(), v.copy()
    if frame is Frame.EME2000:
        return r @ _RB, v @ _RB  # row-vector form of rb.T @ x
    if frame is Frame.TEME:
        c = TEME(_rep(r, v), obstime=times).transform_to(GCRS(obstime=times))
        return _unpack(c)
    if frame is Frame.ITRF:
        c = ITRS(_rep(r, v), obstime=times).transform_to(GCRS(obstime=times))
        return _unpack(c)
    raise FrameError(f"no transformation from {frame}")


def gcrf_to(r: np.ndarray, v: np.ndarray, frame: Frame, times: Time) -> tuple[np.ndarray, np.ndarray]:
    r = np.atleast_2d(np.asarray(r, dtype=float))
    v = np.atleast_2d(np.asarray(v, dtype=float))
    if frame is Frame.GCRF:
        return r.copy(), v.copy()
    if frame is Frame.EME2000:
        return r @ _RB.T, v @ _RB.T
    target = {Frame.TEME: TEME, Frame.ITRF: ITRS}[frame]
    c = GCRS(_rep(r, v), obstime=times).transform_to(target(obstime=times))
    return _unpack(c)


def convert(r: np.ndarray, v: np.ndarray, src: Frame, dst: Frame, times: Time) -> tuple[np.ndarray, np.ndarray]:
    if src is dst:
        return np.atleast_2d(r).copy(), np.atleast_2d(v).copy()
    rg, vg = to_gcrf(r, v, src, times)
    return gcrf_to(rg, vg, dst, times)


def rtn_basis(r: np.ndarray, v: np.ndarray) -> np.ndarray:
    """Rows are the unit R (radial), T (along-track), N (orbit normal) axes.

    For a vector x expressed in the inertial frame, ``basis @ x`` gives its
    RTN components; ``basis.T @ x_rtn`` maps back.
    """
    r = np.asarray(r, dtype=float)
    v = np.asarray(v, dtype=float)
    rh = r / np.linalg.norm(r)
    h = np.cross(r, v)
    hn = np.linalg.norm(h)
    if hn == 0:
        raise FrameError("degenerate state: position parallel to velocity")
    nh = h / hn
    th = np.cross(nh, rh)
    return np.vstack([rh, th, nh])


def geodetic_from_itrf(r_itrf: np.ndarray) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    """WGS-84 geodetic latitude/longitude (deg) and height (km)."""
    r = np.atleast_2d(r_itrf)
    lon, lat, h = erfa.gc2gd(1, r * 1000.0)  # 1 = WGS84, metres in
    return np.degrees(lat), np.degrees(lon), np.asarray(h) / 1000.0
