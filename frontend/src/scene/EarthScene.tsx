import { useEffect, useMemo, useRef } from "react";
import { Canvas, type ThreeEvent } from "@react-three/fiber";
import { Html, Line, OrbitControls } from "@react-three/drei";
import { BufferAttribute, BufferGeometry, Color, type Points } from "three";
import type { VizObject } from "../api/types";
import { makeEarthTexture } from "./earthTexture";

const RE = 6378.137;
/** GCRF km -> scene units (Earth radius = 1), three.js y-up: (x, z, -y). */
export const toScene = (r: number[]): [number, number, number] => [r[0]! / RE, r[2]! / RE, -r[1]! / RE];

export interface TrackLine { id: string; points: number[][]; color: string; label: string }

function Earth({ eraDeg }: { eraDeg: number }) {
  const tex = useMemo(() => makeEarthTexture(true), []);
  useEffect(() => () => tex.dispose(), [tex]);
  return (
    <mesh rotation={[0, (eraDeg * Math.PI) / 180, 0]}>
      <sphereGeometry args={[1, 96, 64]} />
      <meshStandardMaterial map={tex} roughness={1} metalness={0} />
    </mesh>
  );
}

function Markers({ objects, selected, highlight, onSelect }: { objects: VizObject[]; selected: string | null; highlight: Set<string>; onSelect: (id: string) => void }) {
  const ref = useRef<Points>(null);
  const geom = useMemo(() => {
    const g = new BufferGeometry();
    const pos = new Float32Array(objects.length * 3);
    const col = new Float32Array(objects.length * 3);
    const base = new Color("#d9d4cc"), hi = new Color("#ffc500"), sel = new Color("#ff5a36"), stale = new Color("#7a7570");
    objects.forEach((o, i) => {
      const [x, y, z] = toScene(o.r_km);
      pos.set([x, y, z], i * 3);
      const c = o.object_id === selected ? sel : highlight.has(o.object_id) ? hi : o.age_days > 3 && o.kind === "gp_elements" ? stale : base;
      col.set([c.r, c.g, c.b], i * 3);
    });
    g.setAttribute("position", new BufferAttribute(pos, 3));
    g.setAttribute("color", new BufferAttribute(col, 3));
    g.computeBoundingSphere();
    return g;
  }, [objects, selected, highlight]);
  useEffect(() => () => geom.dispose(), [geom]);
  return (
    <points ref={ref} geometry={geom} onClick={(e: ThreeEvent<MouseEvent>) => { e.stopPropagation(); const i = e.index; if (i !== undefined && objects[i]) onSelect(objects[i]!.object_id); }}>
      <pointsMaterial size={objects.length > 1000 ? 3 : objects.length > 200 ? 4 : 6} sizeAttenuation={false} vertexColors />
    </points>
  );
}

export default function EarthScene({ objects, eraDeg, selected, highlight, tracks, showGrid, showLabels, onSelect, marker }: {
  objects: VizObject[]; eraDeg: number; selected: string | null; highlight: Set<string>; tracks: TrackLine[];
  showGrid: boolean; showLabels: boolean; onSelect: (id: string) => void; marker?: { at: number[]; label: string } | null;
}) {
  const labelled = objects.filter((o) => o.object_id === selected || highlight.has(o.object_id));
  return (
    <Canvas camera={{ position: [0, 1.6, 4.2], fov: 45, near: 0.01, far: 200 }} dpr={[1, 2]} raycaster={{ params: { Points: { threshold: 0.03 } } as never }}>
      <color attach="background" args={["#05070a"]} />
      <ambientLight intensity={0.9} />
      <directionalLight position={[5, 3, 5]} intensity={1.1} />
      <Earth eraDeg={eraDeg} />
      {showGrid && (<>
        <Line points={Array.from({ length: 129 }, (_, i) => { const a = (i / 128) * Math.PI * 2; return [Math.cos(a) * 1.002, 0, Math.sin(a) * 1.002] as [number, number, number]; })} color="#3a4652" lineWidth={1} />
        <Line points={[[0, 0, 0], [1.8, 0, 0]]} color="#a33" lineWidth={1} />
        <Line points={[[0, 0, 0], [0, 0, -1.8]]} color="#3a3" lineWidth={1} />
        <Line points={[[0, 0, 0], [0, 1.8, 0]]} color="#36a" lineWidth={1} />
        <Html position={[1.85, 0, 0]} style={{ color: "#c66", fontSize: 10, fontFamily: "var(--fm)" }}>X (GCRF)</Html>
        <Html position={[0, 1.85, 0]} style={{ color: "#69c", fontSize: 10, fontFamily: "var(--fm)" }}>Z</Html>
      </>)}
      <Markers objects={objects} selected={selected} highlight={highlight} onSelect={onSelect} />
      {tracks.map((t) => t.points.length > 1 && <Line key={t.id} points={t.points.map(toScene)} color={t.color} lineWidth={1.5} transparent opacity={0.9} />)}
      {marker && (<>
        <mesh position={toScene(marker.at)}><sphereGeometry args={[0.015, 12, 12]} /><meshBasicMaterial color="#ffc500" /></mesh>
        <Html position={toScene(marker.at)} style={{ color: "#ffc500", fontSize: 11, fontFamily: "var(--fm)", whiteSpace: "nowrap", transform: "translate(8px,-8px)" }}>{marker.label}</Html>
      </>)}
      {showLabels && labelled.map((o) => (
        <Html key={o.object_id} position={toScene(o.r_km)} style={{ color: "#f5f0e8", fontSize: 11, fontFamily: "var(--fm)", whiteSpace: "nowrap", transform: "translate(8px,-6px)", pointerEvents: "none" }}>
          {o.name ?? o.object_id}
        </Html>
      ))}
      <OrbitControls enablePan enableZoom minDistance={1.2} maxDistance={40} />
    </Canvas>
  );
}
