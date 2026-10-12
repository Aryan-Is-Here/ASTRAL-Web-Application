import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { api } from "../api/client";
import type { EncounterDetail, Scenario } from "../api/types";
import EncounterPlane from "../components/EncounterPlane";
import { useProjectId } from "../components/Layout";
import { Empty, ErrorView, JobStatus, Loading, PageHead, PcBadge, Seg } from "../components/ui";
import { useEncounters, useJobs } from "../lib/hooks";
import { km, kms, sci, untilTca, utc } from "../lib/format";

/** "02 Analysis workspace" from the design: conjunction table + geometry + scenario comparison. */
export default function Encounters() {
  const pid = useProjectId();
  const nav = useNavigate();
  const [params, setParams] = useSearchParams();
  const jobs = useJobs(pid);
  const done = useMemo(() => jobs.data?.items.filter((j) => j.status === "succeeded") ?? [], [jobs.data]);
  const jobId = Number(params.get("job")) || done[0]?.id;
  const job = done.find((j) => j.id === jobId);
  const [sort, setSort] = useState<"tca" | "miss" | "pc" | "ml">("tca");
  const [maxMiss, setMaxMiss] = useState("");
  const enc = useEncounters(pid, { job_id: jobId, sort, limit: 500, max_miss_km: maxMiss || undefined });
  const [selId, setSel] = useState<number | null>(null);
  useEffect(() => { setSel(null); }, [jobId]);
  const items = enc.data?.items ?? [];
  const selected = items.find((e) => e.id === selId) ?? items[0];
  const detail = useQuery({ queryKey: ["enc", pid, selected?.id], enabled: !!selected, queryFn: () => api.get<EncounterDetail>(`/projects/${pid}/encounters/${selected!.id}`) });
  const scen = useQuery({ queryKey: ["scen", pid, selected?.id], enabled: !!selected, queryFn: () => api.get<{ items: Scenario[] }>(`/projects/${pid}/encounters/${selected!.id}/scenarios`) });
  const pc = detail.data?.probability[0]?.result;
  const hours = (job?.config.duration_hours as number | undefined) ?? null;
  if (jobs.isLoading) return <div className="page"><Loading /></div>;
  if (!done.length) return <div className="page"><PageHead eyebrow="05 Encounter investigations" title="Encounters" /><Empty>No completed analyses. Run a screening first.</Empty></div>;
  return (
    <div className="page">
      <PageHead eyebrow="05 Encounter investigations" title="Analysis workspace">
        Geometric screening results. A small miss distance is not a collision prediction; probability is shown only where covariance and hard-body radius allow it.
      </PageHead>
      <div className="panel">
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 16, padding: "calc(var(--d)*12px) 20px", borderBottom: "var(--rw) solid var(--rule)", background: "var(--s1)" }}>
          <span className="brand" style={{ fontSize: 14 }}>ASTRAL</span>
          <span className="muted">Analyses / <label className="sr-only" htmlFor="jobsel">Run</label>
            <select id="jobsel" className="input" style={{ padding: "2px 6px" }} value={jobId} onChange={(e) => setParams({ job: e.target.value })}>
              {done.map((j) => <option key={j.id} value={j.id}>Run {String(j.id).padStart(4, "0")} · {j.kind.replace("_", " ")}</option>)}
            </select>
          </span>
          <span style={{ marginLeft: "auto" }} className="mono muted">{job?.config.start_utc ? `Epoch ${utc(String(job.config.start_utc))}` : `TCA from CDM`}</span>
          {job && <JobStatus status={job.status === "succeeded" ? (job.kind === "screening" ? "screened" : "assessed") : job.status} />}
        </div>
        <div className="grid cols-2" style={{ gap: 0 }}>
          <div style={{ borderRight: "1px solid var(--hair)", minWidth: 0 }}>
            <div className="panel-head" style={{ borderBottom: 0 }}>
              <h3>Conjunctions</h3>
              <span className="muted" style={{ fontSize: 13 }}>{enc.data?.total ?? 0} events{hours ? ` · ${hours} h window` : ""}{job?.config.threshold_km ? ` · ≤ ${String(job.config.threshold_km)} km` : " · CDM-supplied TCA"}</span>
            </div>
            <div style={{ display: "flex", gap: 10, padding: "0 20px 10px", flexWrap: "wrap", alignItems: "center" }}>
              <Seg label="Sort" value={sort} onChange={setSort} options={[{ value: "tca", label: "TCA" }, { value: "miss", label: "Miss" }, { value: "pc", label: "Pc" }, { value: "ml", label: "ML priority" }]} />
              <input className="input mono" style={{ width: 140 }} placeholder="max miss km" value={maxMiss} onChange={(e) => setMaxMiss(e.target.value)} aria-label="Maximum miss distance in km" />
            </div>
            {enc.error && <ErrorView error={enc.error} />}
            <div className="table-wrap" style={{ maxHeight: 560, overflowY: "auto" }}>
              <table className="data">
                <thead><tr><th>Event</th><th>Objects</th><th>TCA</th><th className="num">Miss</th><th className="num">Pc</th><th>Probability</th></tr></thead>
                <tbody>
                  {items.map((e) => (
                    <tr key={e.id} className={`clickable ${e.id === selected?.id ? "selected" : ""}`} onClick={() => setSel(e.id)} aria-selected={e.id === selected?.id}
                      onDoubleClick={() => nav(`/p/${pid}/encounters/${e.id}`)}>
                      <td className="mono" style={{ fontSize: 13 }}>EVT-{String(e.id).padStart(4, "0")}</td>
                      <td style={{ whiteSpace: "nowrap" }}>{e.primary_name ?? e.primary_id} × {e.secondary_name ?? e.secondary_id}</td>
                      <td className="mono muted" style={{ fontSize: 13 }} title={utc(e.tca_utc)}>{untilTca(e.tca_utc)}</td>
                      <td className="num">{km(e.miss_km)}</td>
                      <td className="num">{e.pc_value === null ? "—" : sci(e.pc_value, 1)}</td>
                      <td><PcBadge status={e.pc_status} value={e.pc_value} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {items.length === 0 && !enc.isLoading && <Empty>No encounters met the threshold in this run.</Empty>}
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
            <div className="panel-head" style={{ borderBottom: 0 }}>
              <h3>Encounter geometry</h3>
              {selected && <Link className="mono" style={{ color: "var(--accT)", fontSize: 13 }} to={`/p/${pid}/encounters/${selected.id}`}>EVT-{String(selected.id).padStart(4, "0")} · investigate →</Link>}
            </div>
            {selected ? (
              <>
                <div style={{ margin: "0 20px" }}>
                  <EncounterPlane miss={selected.geometry.miss_in_plane_km} cov={pc?.details.projected_cov_km2} hbrKm={pc?.details.hbr_km} />
                </div>
                <div className="stats" style={{ margin: "calc(var(--d)*16px) 20px calc(var(--d)*20px)", gridTemplateColumns: "repeat(2, minmax(0,1fr))" }}>
                  <div className="stat"><span className="label">Miss distance</span><span className="v" style={{ fontSize: 18 }}>{km(selected.miss_km)}</span></div>
                  <div className="stat"><span className="label">Probability</span><span className="v" style={{ fontSize: 18 }}>{selected.pc_value === null ? "not computed" : sci(selected.pc_value, 2)}</span></div>
                  <div className="stat"><span className="label">Rel. velocity</span><span className="v" style={{ fontSize: 18 }}>{kms(selected.rel_speed_km_s)}</span></div>
                  <div className="stat"><span className="label">Covariance</span><span style={{ fontSize: 15, paddingTop: 2 }}>{{ both: "Available", partial: "Partial", none: "Missing" }[selected.covariance_available]}</span></div>
                </div>
              </>
            ) : <Empty>Select an event.</Empty>}
          </div>
        </div>
        {selected && (
          <div style={{ borderTop: "var(--rw) solid var(--rule)" }}>
            <div className="panel-head" style={{ borderBottom: 0 }}>
              <h3>Scenario comparison</h3>
              <span className="muted" style={{ fontSize: 13 }}>EVT-{String(selected.id).padStart(4, "0")} · hypothetical manoeuvres · simulation only</span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 240px), 1fr))", borderTop: "1px solid var(--hair)" }}>
              <ScenarioCard title="Baseline" tag="No action" miss={scen.data?.items[0]?.result.baseline.miss_km ?? selected.miss_km} pc={selected.pc_value} dv={null} baseline={selected.miss_km} tone="alert" />
              {scen.data?.items.slice(0, 3).map((s) => (
                <ScenarioCard key={s.id} title={s.name} tag="Simulated" miss={s.result.alternative.miss_km} pc={null} dv={s.result.dv_magnitude_m_s} baseline={selected.miss_km} tone="acc" />
              ))}
              {(scen.data?.items.length ?? 0) === 0 && (
                <div style={{ padding: "calc(var(--d)*16px) 20px", display: "flex", flexDirection: "column", gap: 8, justifyContent: "center" }}>
                  <span className="muted">No scenarios yet.</span>
                  <Link className="btn small" to={`/p/${pid}/scenarios?encounter=${selected.id}`} style={{ alignSelf: "flex-start" }}>Simulate a manoeuvre</Link>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function ScenarioCard({ title, tag, miss, pc, dv, baseline, tone }: { title: string; tag: string; miss: number | null; pc: number | null; dv: number | null; baseline: number; tone: "alert" | "acc" }) {
  // bar shows miss distance relative to max(miss, 2×baseline) — a visual aid only
  const width = miss === null ? 0 : Math.min(100, (miss / Math.max(baseline * 2, miss)) * 100);
  return (
    <div style={{ padding: "calc(var(--d)*16px) 20px", display: "flex", flexDirection: "column", gap: "calc(var(--d)*12px)", borderRight: "1px solid var(--hair)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <span style={{ fontWeight: 600, fontSize: 15 }}>{title}</span>
        <span className="label" style={{ color: tone === "acc" ? "var(--accT)" : undefined }}>{tag}</span>
      </div>
      <div className="progress" title="Miss distance (relative scale)"><div style={{ width: `${width}%`, background: tone === "alert" ? "var(--alert)" : "var(--acc)" }} /></div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr auto", rowGap: 6, fontSize: 14 }}>
        <span className="muted">Pc</span><span className="mono">{pc === null ? "—" : sci(pc)}</span>
        <span className="muted">Miss</span><span className="mono">{km(miss)}</span>
        <span className="muted">Δv</span><span className="mono">{dv === null ? "—" : `${dv.toFixed(2)} m/s`}</span>
      </div>
    </div>
  );
}
