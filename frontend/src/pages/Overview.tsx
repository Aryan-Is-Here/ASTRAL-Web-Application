import { Link } from "react-router-dom";
import { useProjectId } from "../components/Layout";
import { Empty, ErrorView, JobStatus, Loading, PageHead, Panel, PcBadge, Stat } from "../components/ui";
import { useDatasets, useEncounters, useJobs, versionsOf } from "../lib/hooks";
import { km, kms, untilTca, utc } from "../lib/format";

/** Mission overview: every number here is a count of stored records. */
export default function Overview() {
  const pid = useProjectId();
  const ds = useDatasets(pid);
  const jobs = useJobs(pid);
  const enc = useEncounters(pid, { sort: "miss", limit: 8 });
  const versions = versionsOf(ds.data?.items);
  const latestJob = jobs.data?.items.find((j) => j.status === "succeeded");
  const objects = versions[0]?.v.stats.objects;
  const counts = (s: string) => jobs.data?.items.filter((j) => j.status === s).length ?? 0;
  if (ds.error) return <div className="page"><ErrorView error={ds.error} /></div>;
  return (
    <div className="page">
      <PageHead eyebrow="01 Mission overview" title="Overview">
        Stored datasets, analyses and the closest computed approaches in this project. Counts are read from the database; nothing on this page is estimated.
      </PageHead>
      <div className="stats">
        <Stat label="Datasets" value={ds.data?.items.length ?? "—"} />
        <Stat label="Dataset versions" value={versions.length} />
        <Stat label="Objects (latest version)" value={objects ?? "—"} />
        <Stat label="Jobs succeeded" value={counts("succeeded")} />
        <Stat label="Jobs running / queued" value={`${counts("running")} / ${counts("queued")}`} />
        <Stat label="Jobs failed" value={counts("failed")} />
        <Stat label="Stored encounters" value={enc.data?.total ?? "—"} />
      </div>
      <div className="grid cols-2">
        <Panel title="Closest computed approaches" meta="all jobs · sorted by miss distance" actions={<Link className="btn small" to={`/p/${pid}/encounters`}>All encounters</Link>}>
          {enc.isLoading && <Loading />}
          {enc.data?.items.length === 0 && <Empty>No encounters yet. Upload data in Datasets, then run a screening.</Empty>}
          <div className="table-wrap">
            <table className="data">
              <thead><tr><th>Objects</th><th>TCA</th><th className="num">Miss</th><th className="num">v_rel</th><th>Probability</th></tr></thead>
              <tbody>
                {enc.data?.items.map((e) => (
                  <tr key={e.id}>
                    <td><Link to={`/p/${pid}/encounters/${e.id}`}>{e.primary_name ?? e.primary_id} × {e.secondary_name ?? e.secondary_id}</Link></td>
                    <td className="mono muted" title={utc(e.tca_utc)}>{untilTca(e.tca_utc)}</td>
                    <td className="num">{km(e.miss_km)}</td>
                    <td className="num">{kms(e.rel_speed_km_s)}</td>
                    <td><PcBadge status={e.pc_status} value={e.pc_value} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
        <Panel title="Recent analyses" actions={<Link className="btn small" to={`/p/${pid}/screening`}>Screening</Link>}>
          {jobs.data?.items.length === 0 && <Empty>No analyses yet.</Empty>}
          <table className="data">
            <tbody>
              {jobs.data?.items.slice(0, 8).map((j) => (
                <tr key={j.id}>
                  <td className="mono">#{j.id}</td>
                  <td>{j.kind.replace("_", " ")}</td>
                  <td><JobStatus status={j.status} /></td>
                  <td className="muted">{utc(j.created_at)}</td>
                  <td className="num">{String(j.stats?.encounters ?? "—")} enc.</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>
      </div>
      <Panel title="Datasets" meta="newest versions first">
        <table className="data">
          <thead><tr><th>Dataset</th><th>Version</th><th>Format</th><th>Status</th><th className="num">Records</th><th className="num">Errors</th><th className="num">Warnings</th><th>Created</th></tr></thead>
          <tbody>
            {versions.slice(0, 8).map(({ ds: d, v }) => (
              <tr key={v.id}>
                <td>{d.name}</td>
                <td className="mono">v{v.version}</td>
                <td className="mono">{v.format}</td>
                <td><span className={`badge ${v.status === "needs_review" ? "warn" : "ok"}`}>{v.status.replace("_", " ")}</span></td>
                <td className="num">{v.stats.records}</td>
                <td className="num">{v.stats.errors}</td>
                <td className="num">{v.stats.warnings}</td>
                <td className="muted">{utc(v.created_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Panel>
      {latestJob && (
        <div className="notice info">Latest completed screening: job #{latestJob.id}, {String(latestJob.stats?.objects ?? "?")} objects, {String(latestJob.stats?.encounters ?? "?")} encounters within {String(latestJob.config.threshold_km ?? "?")} km.</div>
      )}
    </div>
  );
}
