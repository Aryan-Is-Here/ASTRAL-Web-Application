import { useMemo, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { Html, Line, OrbitControls } from "@react-three/drei";

type V3 = [number, number, number];

/** Exact closest point to the origin on the sampled path (searching every segment). */
function closestOnPath(p: number[][]): { point: number[]; dist: number; index: number } {
  let best = { point: p[0]!, dist: Infinity, index: 0 };
  for (let i = 0; i + 1 < p.length; i++) {
    const a = p[i]!, b = p[i + 1]!;
    const d = [b[0]! - a[0]!, b[1]! - a[1]!, b[2]! - a[2]!];
    const dd = d[0]! ** 2 + d[1]! ** 2 + d[2]! ** 2;
    const s = dd > 0 ? Math.min(Math.max(-(a[0]! * d[0]! + a[1]! * d[1]! + a[2]! * d[2]!) / dd, 0), 1) : 0;
    const q = [a[0]! + s * d[0]!, a[1]! + s * d[1]!, a[2]! + s * d[2]!];
    const dist = Math.hypot(q[0]!, q[1]!, q[2]!);
    if (dist < best.dist) best = { point: q, dist, index: i };
  }
  return best;
}

/**
 * Secondary's nominal path relative to the primary (at the origin), axes R/T/N.
 * Default view is zoomed so the real gap at closest approach is visible; the
 * whole fly-by spans hundreds of km and would otherwise hide a km-scale gap.
 */
export default function RelativeScene({ rtn }: { rtn: number[][]; t: number[] }) {
  const [zoom, setZoom] = useState(true);
  const view = useMemo(() => {
    const c = closestOnPath(rtn);
    const half = zoom ? Math.max(c.dist * 1.5, 0.05) : Math.max(...rtn.flat().map(Math.abs), 1e-3);
    const s = 4 / half; // scene units per km
    // three.js axes: x = T (along-track), y = R (radial), z = N (cross-track)
    const toS = (p: number[]): V3 => [p[1]! * s, p[0]! * s, p[2]! * s];
    let pts: V3[];
    if (zoom) {
      // Near TCA the relative motion is a straight line: draw the segment through the closest point.
      const a = rtn[c.index]!, b = rtn[c.index + 1] ?? a;
      const d = [b[0]! - a[0]!, b[1]! - a[1]!, b[2]! - a[2]!];
      const n = Math.hypot(d[0]!, d[1]!, d[2]!) || 1;
      const u = d.map((x) => x / n);
      const L = half * 1.6;
      pts = [-L, L].map((k) => toS([c.point[0]! + u[0]! * k, c.point[1]! + u[1]! * k, c.point[2]! + u[2]! * k]));
    } else {
      pts = rtn.map(toS);
    }
    // Camera: in zoom mode look side-on, perpendicular to both the flight path and the gap,
    // so the gap is seen at its true length; otherwise a general oblique view.
    let cam: V3 = [4.5, 3, 5.5];
    const g = toS(c.point);
    if (zoom && pts.length === 2) {
      const pd = [pts[1]![0] - pts[0]![0], pts[1]![1] - pts[0]![1], pts[1]![2] - pts[0]![2]];
      const nx = pd[1]! * g[2] - pd[2]! * g[1], ny = pd[2]! * g[0] - pd[0]! * g[2], nz = pd[0]! * g[1] - pd[1]! * g[0];
      const nn = Math.hypot(nx, ny, nz);
      if (nn > 1e-9) {
        const k = 9 / nn;
        // small tilt so the scene does not look perfectly flat
        cam = [g[0] / 2 + nx * k + 0.8, g[1] / 2 + ny * k + 0.8, g[2] / 2 + nz * k];
      }
    }
    return { pts, closest: g, gapKm: c.dist, unitKm: 1 / s, cam, target: [g[0] / 2, g[1] / 2, g[2] / 2] as V3 };
  }, [rtn, zoom]);

  const axis = (to: V3, label: string) => (
    <>
      <Line points={[[0, 0, 0], to]} color="#666" lineWidth={1} />
      <Html position={to} style={{ color: "#aaa", fontSize: 11, fontFamily: "var(--fm)" }}>{label}</Html>
    </>
  );
  const r = zoom ? 0.13 : 0.06;
  return (
    <div style={{ position: "relative", height: "100%" }}>
      <Canvas key={zoom ? "zoom" : "all"} camera={{ position: view.cam, fov: 45 }} style={{ background: "var(--s1)" }} aria-label="3D relative trajectory">
        <ambientLight intensity={0.8} />
        {axis([5, 0, 0], "along-track")}{axis([0, 5, 0], "radial")}{axis([0, 0, 5], "cross-track")}
        <Line points={view.pts} color="#ff5a36" lineWidth={2} />
        {/* the gap at closest approach */}
        <Line points={[[0, 0, 0], view.closest]} color="#ffc500" lineWidth={1.5} dashed dashSize={0.15} gapSize={0.1} />
        <mesh position={[0, 0, 0]}><sphereGeometry args={[r, 16, 16]} /><meshBasicMaterial color="#f5f0e8" /></mesh>
        <mesh position={view.closest}><sphereGeometry args={[r, 16, 16]} /><meshBasicMaterial color="#ffc500" /></mesh>
        <Html position={[0, 0, 0]} style={{ color: "#f5f0e8", fontSize: 11, fontFamily: "var(--fm)", whiteSpace: "nowrap", transform: "translate(calc(-100% - 10px), 6px)", pointerEvents: "none" }}>first object</Html>
        <Html position={view.closest} style={{ color: "#ffc500", fontSize: 11, fontFamily: "var(--fm)", whiteSpace: "nowrap", transform: "translate(10px, -24px)", pointerEvents: "none" }}>second object (closest approach)</Html>
        <Html position={[view.closest[0] / 2, view.closest[1] / 2, view.closest[2] / 2]}
          style={{ color: "#ffc500", fontSize: 12, fontWeight: 700, fontFamily: "var(--fm)", whiteSpace: "nowrap", transform: "translate(8px, 2px)", pointerEvents: "none" }}>
          gap {view.gapKm.toFixed(3)} km
        </Html>
        <OrbitControls enablePan enableZoom target={zoom ? view.target : [0, 0, 0]} />
      </Canvas>
      <div style={{ position: "absolute", left: 10, top: 10, display: "flex", gap: 8, alignItems: "center" }}>
        <div className="seg" role="group" aria-label="View">
          <button type="button" aria-pressed={zoom} onClick={() => setZoom(true)}>Closest point</button>
          <button type="button" aria-pressed={!zoom} onClick={() => setZoom(false)}>Whole fly-by</button>
        </div>
      </div>
      <div className="mono muted" style={{ position: "absolute", left: 10, bottom: 8, fontSize: 11 }}>
        grid unit = {view.unitKm < 1 ? `${(view.unitKm * 1000).toFixed(0)} m` : `${view.unitKm.toFixed(1)} km`} · nominal paths, no uncertainty
        {!zoom && " · at this scale the km-sized gap is too small to see"}
      </div>
    </div>
  );
}
