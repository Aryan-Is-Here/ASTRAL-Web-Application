import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { api, qs } from "../api/client";
import type { EncounterDetail, Trajectory, VizPositions } from "../api/types";
import { useProjectId } from "../components/Layout";
import VersionPicker from "../components/VersionPicker";
import { ErrorView, PageHead } from "../components/ui";
import EarthScene, { type TrackLine } from "../scene/EarthScene";
import { useDatasets, useJobs, versionsOf } from "../lib/hooks";
import { ageLabel, km, utc } from "../lib/format";

const iso = (ms: number) => new Date(ms).toISOString().slice(0, 19) + "Z";

export default function Environment() {
  const pid = useProjectId();
  const [params] = useSearchParams();
  const encId = Number(params.get("encounter")) || null;
  const ds = useDatasets(pid);
  const jobs = useJobs(pid);
  const enc = useQuery({ queryKey: ["enc", pid, encId], enabled: !!encId, queryFn: () => api.get<EncounterDetail>(`/projects/${pid}/encounters/${encId}`) });
  const [vid, setVid] = useState<number | null>(null);
  const [base, setBase] = useState<number>(() => Math.floor(Date.now() / 60000) * 60000);
  const [offsetMin, setOffsetMin] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [showGrid, setGrid] = useState(true);
  const [showLabels, setLabels] = useState(true);
  const [showTracks, setTracks] = useState(true);

  useEffect(() => {
    if (enc.data && jobs.data) {
      const job = jobs.data.items.find((j) => j.id === enc.data!.job.id);
      if (job && job.kind === "screening") setVid(job.dataset_version_id);
      setBase(Date.parse(enc.data.tca_utc));
      setOffsetMin(0);
      setSelected(enc.data.primary_id);
    }
  }, [enc.data, jobs.data]);
  useEffect(() => {
    if (vid === null && ds.data && !encId) setVid(versionsOf(ds.data.items).find((x) => !x.v.format.startsWith("CDM") && !x.v.format.startsWith("STATES"))?.v.id ?? null);
  }, [ds.data, vid, encId]);
  useEffect(() => {
    if (!playing) return;
    const h = setInterval(() => setOffsetMin((m) => (m >= 720 ? -720 : m + 2)), 600);
    return () => clearInterval(h);
  }, [playing]);

  const at = iso(base + offsetMin * 60000);
  const pos = useQuery({
    queryKey: ["viz", pid, vid, at],
    enabled: vid !== null,
    queryFn: () => api.get<VizPositions>(`/projects/${pid}/viz/positions${qs({ vid, at })}`),
    placeholderData: (p) => p,
  });
  const highlight = useMemo(() => new Set(enc.data ? [enc.data.primary_id, enc.data.secondary_id] : []), [enc.data]);
  const trackIds = useMemo(() => [...new Set([...(selected ? [selected] : []), ...highlight])], [selected, highlight]);
  const trackStart = enc.data ? iso(Date.parse(enc.data.tca_utc) - 45 * 60000) : iso(base + offsetMin * 60000);
  const tracks = useQuery({
    queryKey: ["tracks", pid, vid, trackIds.join(","), trackStart],
    enabled: vid !== null && trackIds.length > 0 && showTracks,
    queryFn: () => Promise.all(trackIds.map((id) => api.get<Trajectory>(`/projects/${pid}/viz/trajectory${qs({ vid, object_id: id, start: trackStart, duration_s: enc.data ? 5400 : 6000, points: 300 })}`))),
  });
  const lines: TrackLine[] = (tracks.data ?? []).map((t) => ({ id: t.object_id, points: t.r_km, color: t.object_id === enc.data?.secondary_id ? "#ffc500" : "#ff5a36", label: t.object_id }));
  const sel = pos.data?.objects.find((o) => o.object_id === selected);
  const primaryNow = enc.data ? pos.data?.objects.find((o) => o.object_id === enc.data!.primary_id) : undefined;
  const tcaMarker = enc.data && primaryNow && offsetMin === 0 && Math.abs(Date.parse(at) - Date.parse(enc.data.tca_utc)) < 60000
    ? { at: primaryNow.r_km, label: `TCA · miss ${km(enc.data.miss_km)}` } : null;

  return (
    <div className="page" style={{ gap: 16 }}>
      <PageHead eyebrow="03 3D orbital environment" title="Orbital environment">
        Positions are propagated by the backend from the selected dataset (GCRF). Orbit lines connect propagated samples; segments between samples are visual interpolation. No uncertainty is drawn.
      </PageHead>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end" }}>
        <VersionPicker datasets={ds.data?.items} value={vid} onChange={(v) => { setVid(v); setSelected(null); }} filter={(f) => !f.startsWith("CDM") && !f.startsWith("STATES")} />
        <label className="field" style={{ flex: 1, minWidth: 280 }}>
          Time · {utc(at)} ({offsetMin >= 0 ? "+" : ""}{offsetMin} min)
          <input type="range" min={-720} max={720} step={1} value={offsetMin} onChange={(e) => setOffsetMin(Number(e.target.value))} aria-label="Time offset in minutes" />
        </label>
        <button className="btn" onClick={() => setPlaying(!playing)} aria-pressed={playing}>{playing ? "Pause" : "Play"}</button>
        <button className="btn" onClick={() => { setBase(Math.floor(Date.now() / 60000) * 60000); setOffsetMin(0); }}>Now</button>
        {enc.data && <button className="btn" onClick={() => { setBase(Date.parse(enc.data!.tca_utc)); setOffsetMin(0); }}>TCA</button>}
      </div>
      {enc.data?.job.kind === "cdm_assessment" && <div className="notice">This encounter comes from a CDM (states at TCA only). The 3D view needs a propagatable dataset; open the encounter's relative-motion view instead.</div>}
      {pos.error && <ErrorView error={pos.error} />}
      <div className="scene">
        {pos.data && <EarthScene objects={pos.data.objects} eraDeg={pos.data.earth_rotation_angle_deg} selected={selected} highlight={highlight} tracks={showTracks ? lines : []}
          showGrid={showGrid} showLabels={showLabels} onSelect={setSelected} marker={tcaMarker} />}
        <div className="scene-overlay">
          <div className="scene-card">
            <div className="label">Scene</div>
            <div className="mono">{pos.data ? `${pos.data.objects.length} objects · ${pos.data.frame}` : pos.isLoading ? "propagating…" : "select a dataset"}</div>
            {pos.isFetching && <div className="muted">updating…</div>}
            {pos.data?.not_shown ? <div className="muted">{pos.data.not_shown} objects without a valid state at this time</div> : null}
            {pos.data?.notes.map((n) => <div key={n} className="muted" style={{ marginTop: 4 }}>{n}</div>)}
            <div style={{ display: "flex", gap: 10, marginTop: 8, flexWrap: "wrap" }}>
              <label><input type="checkbox" checked={showGrid} onChange={(e) => setGrid(e.target.checked)} /> frame axes</label>
              <label><input type="checkbox" checked={showLabels} onChange={(e) => setLabels(e.target.checked)} /> labels</label>
              <label><input type="checkbox" checked={showTracks} onChange={(e) => setTracks(e.target.checked)} /> orbits</label>
            </div>
            <div className="muted" style={{ marginTop: 6 }}>Grey markers: GP elements older than 3 days.</div>
          </div>
          {sel && (
            <div className="scene-card">
              <div className="label">Selected object</div>
              <div style={{ fontWeight: 600 }}>{sel.name ?? sel.object_id} <span className="mono muted">{sel.object_id}</span></div>
              <div className="mono">|r| {km(Math.hypot(...sel.r_km), 1)} · alt {km(Math.hypot(...sel.r_km) - 6378.137, 1)}</div>
              <div className="mono">|v| {Math.hypot(...sel.v_km_s).toFixed(3)} km/s</div>
              <div>Data age {ageLabel(sel.age_days)} · {sel.kind.replace("_", " ")}</div>
              <div className="muted">{sel.method}</div>
              <div style={{ marginTop: 6 }}><Link to={`/p/${pid}/encounters`}>Encounters involving this object</Link></div>
            </div>
          )}
        </div>
      </div>
      <span className="muted" style={{ fontSize: 12 }}>
        Earth orientation: rotated by the Earth Rotation Angle{pos.data && !pos.data.earth_rotation_uses_ut1 ? " (UT1 approximated by UTC)" : ""}; precession-nutation is ignored for the texture only (≈0.4°, visual).
      </span>
    </div>
  );
}
