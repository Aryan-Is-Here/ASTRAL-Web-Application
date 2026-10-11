import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../api/client";
import type { EncounterDetail, Scenario } from "../api/types";
import { useProjectId } from "../components/Layout";
import { Empty, ErrorView, Loading, PageHead, Panel } from "../components/ui";
import { useEncounters } from "../lib/hooks";
import { km, utc } from "../lib/format";

function Form({ pid, eid }: { pid: number; eid: number }) {
  const qc = useQueryClient();
  const [f, setF] = useState({ name: "Along-track +0.1 m/s", burn_minutes_before_tca: 90, dv_r_m_s: 0, dv_t_m_s: 0.1, dv_n_m_s: 0, spacecraft_mass_kg: "", isp_s: "", screen_other_objects: true });
  const [confirm, setConfirm] = useState(false);
  const run = useMutation({
    mutationFn: () => api.post<Scenario>(`/projects/${pid}/encounters/${eid}/scenarios`, {
      ...f, spacecraft_mass_kg: f.spacecraft_mass_kg ? Number(f.spacecraft_mass_kg) : null, isp_s: f.isp_s ? Number(f.isp_s) : null,
    }),
    onSuccess: () => { setConfirm(false); qc.invalidateQueries({ queryKey: ["scen", pid, eid] }); },
  });
  const num = (k: keyof typeof f, label: string, step = 0.01, hint?: string) => (
    <label className="field">{label}<input className="mono" type="number" step={step} value={String(f[k])} onChange={(e) => setF({ ...f, [k]: e.target.value === "" ? "" : Number(e.target.value) })} />{hint && <span className="hint">{hint}</span>}</label>
  );
  return (
    <Panel title="Define hypothetical manoeuvre" meta="impulsive Δv in the primary's RTN frame">
      <div className="panel-body" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <label className="field">Scenario name<input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} maxLength={200} /></label>
        <div className="grid cols-4">
          {num("burn_minutes_before_tca", "Burn (min before TCA)", 1)}
          {num("dv_r_m_s", "Δv radial (m/s)")}
          {num("dv_t_m_s", "Δv along-track (m/s)")}
          {num("dv_n_m_s", "Δv cross-track (m/s)")}
          {num("spacecraft_mass_kg", "Spacecraft mass (kg)", 1, "optional; needed for propellant")}
          {num("isp_s", "Specific impulse (s)", 1, "optional")}
        </div>
        <label><input type="checkbox" checked={f.screen_other_objects} onChange={(e) => setF({ ...f, screen_other_objects: e.target.checked })} /> Screen the alternative trajectory against all other objects in the dataset (≤ 500)</label>
        {!confirm ? (
          <div><button className="btn primary" onClick={() => setConfirm(true)}>Run simulation…</button></div>
        ) : (
          <div className="notice">
            This creates and saves a <strong>simulation-only</strong> scenario. It does not command any spacecraft and is not a recommendation. Continue?
            <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
              <button className="btn primary small" disabled={run.isPending} onClick={() => run.mutate()}>{run.isPending ? "Simulating…" : "Yes, simulate and save"}</button>
              <button className="btn small" onClick={() => setConfirm(false)}>Cancel</button>
            </div>
          </div>
        )}
        {run.error && <ErrorView error={run.error} />}
      </div>
    </Panel>
  );
}

function ScenarioView({ s, pid, eid }: { s: Scenario; pid: number; eid: number }) {
  const qc = useQueryClient();
  const del = useMutation({ mutationFn: () => api.del(`/projects/${pid}/scenarios/${s.id}`), onSuccess: () => qc.invalidateQueries({ queryKey: ["scen", pid, eid] }) });
  const r = s.result;
  return (
    <Panel title={s.name} meta={`${utc(s.created_at)} · ${r.algorithm}`} actions={<button className="btn small ghost" onClick={() => del.mutate()}>Delete</button>}>
      <div className="panel-body" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <span className="badge warn" style={{ alignSelf: "flex-start" }}>{r.label}</span>
        <div className="stats">
          <div className="stat"><span className="label">Baseline miss (scenario model)</span><span className="v">{km(r.baseline.miss_km)}</span><span className="muted mono" style={{ fontSize: 11 }}>{utc(r.baseline.tca_utc)}</span></div>
          <div className="stat"><span className="label">Alternative miss</span><span className="v">{km(r.alternative.miss_km)}</span><span className="muted mono" style={{ fontSize: 11 }}>{utc(r.alternative.tca_utc)}</span></div>
          <div className="stat"><span className="label">Change</span><span className="v">{r.miss_change_km === null ? "—" : `${r.miss_change_km >= 0 ? "+" : ""}${r.miss_change_km.toFixed(3)} km`}</span></div>
          <div className="stat"><span className="label">|Δv|</span><span className="v">{r.dv_magnitude_m_s.toFixed(3)} m/s</span><span className="muted" style={{ fontSize: 11 }}>{r.propellant_kg === null ? "propellant not estimated" : `≈ ${r.propellant_kg.toFixed(3)} kg propellant`}</span></div>
        </div>
        <div style={{ fontSize: 13 }}>
          <strong>Other encounters on the alternative trajectory:</strong>{" "}
          {r.other_encounters.length === 0 ? "none found within the screening threshold (in the screened set)." : (
            <ul>{r.other_encounters.map((o, i) => <li key={i} className="mono">{o.primary} × {o.secondary} · {utc(o.tca_utc)} · {km(o.geometry.miss_km)}</li>)}</ul>
          )}
        </div>
        <div style={{ fontSize: 12 }} className="muted">Model divergence at TCA vs source propagator: {Object.entries(r.model_divergence_km).map(([k, v]) => `${k} ${v === null ? "n/a" : km(v)}`).join(" · ")}. {r.model}</div>
        <ul style={{ fontSize: 12, margin: 0, paddingLeft: 18 }}>{r.warnings.map((w) => <li key={w}>{w}</li>)}</ul>
      </div>
    </Panel>
  );
}

export default function Scenarios() {
  const pid = useProjectId();
  const [params, setParams] = useSearchParams();
  const encs = useEncounters(pid, { sort: "miss", limit: 200 });
  const eid = Number(params.get("encounter")) || encs.data?.items.find((e) => e.refinement_status !== "SUPPLIED_TCA")?.id;
  const enc = useQuery({ queryKey: ["enc", pid, eid], enabled: !!eid, queryFn: () => api.get<EncounterDetail>(`/projects/${pid}/encounters/${eid}`) });
  const scen = useQuery({ queryKey: ["scen", pid, eid], enabled: !!eid, queryFn: () => api.get<{ items: Scenario[] }>(`/projects/${pid}/encounters/${eid}/scenarios`) });
  return (
    <div className="page">
      <PageHead eyebrow="09 Scenario simulations" title="Scenario simulations">
        Compare a baseline trajectory with hypothetical impulsive manoeuvres. Simulation and decision support only — results require independent expert review, never command a spacecraft, and an increased miss distance for one event does not make a manoeuvre safe.
      </PageHead>
      <label className="field" style={{ maxWidth: 560 }}>Encounter
        <select value={eid ?? ""} onChange={(e) => setParams({ encounter: e.target.value })}>
          {encs.data?.items.filter((e) => e.refinement_status !== "SUPPLIED_TCA").map((e) => (
            <option key={e.id} value={e.id}>EVT-{String(e.id).padStart(4, "0")} · {e.primary_id} × {e.secondary_id} · {km(e.miss_km)} · {utc(e.tca_utc)}</option>
          ))}
        </select>
      </label>
      {!eid && <Empty>No screening encounters available. CDM-only encounters cannot be simulated (no propagation model).</Empty>}
      {enc.data && <div className="notice info">Screening result: {km(enc.data.miss_km, 4)} at {utc(enc.data.tca_utc)} · <Link to={`/p/${pid}/encounters/${enc.data.id}`}>investigate</Link></div>}
      {eid && <Form pid={pid} eid={eid} />}
      {scen.isLoading && <Loading />}
      {scen.data?.items.map((s) => <ScenarioView key={s.id} s={s} pid={pid} eid={eid!} />)}
    </div>
  );
}
