import { useGLTF } from "@react-three/drei";
import { Suspense, useEffect, useMemo, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { setHud } from "./hud";
import { playWhoosh } from "./whoosh";

const WINDUP = 0.225;
const RELEASE = 0.475;
const RECOVERY = 0.8;
const TOTAL = WINDUP + RELEASE + RECOVERY;

type Pose = { x: number; y: number; z: number; rx: number; ry: number; rz: number };

const IDLE: Pose = { x: 0.18, y: -0.32, z: -0.48, rx: -0.2, ry: 0.18, rz: -0.08 };
const WIND: Pose = { x: 0.42, y: -0.05, z: -0.32, rx: 0.72, ry: -0.85, rz: 0.7 };
const STRIKE: Pose = { x: -0.28, y: -0.36, z: -0.62, rx: -0.95, ry: 0.55, rz: -1.15 };
const FOLLOW: Pose = { x: -0.12, y: -0.48, z: -0.42, rx: -0.35, ry: 0.35, rz: -0.45 };

function lerpPose(a: Pose, b: Pose, t: number): Pose {
  const s = t * t * (3 - 2 * t);
  return {
    x: a.x + (b.x - a.x) * s,
    y: a.y + (b.y - a.y) * s,
    z: a.z + (b.z - a.z) * s,
    rx: a.rx + (b.rx - a.rx) * s,
    ry: a.ry + (b.ry - a.ry) * s,
    rz: a.rz + (b.rz - a.rz) * s,
  };
}

function easeOut(t: number) {
  return 1 - (1 - t) * (1 - t);
}

function Viewmodel() {
  const sword = useGLTF("/models/fantasy-sword.glb");
  const hand = useGLTF("/models/gauntlet.glb");
  const lead = useMemo(() => hand.scene.clone(true), [hand.scene]);
  const off = useMemo(() => hand.scene.clone(true), [hand.scene]);
  return (
    <group>
      <primitive
        object={sword.scene}
        position={[0, 0.42, 0]}
        rotation={[Math.PI / 2, Math.PI, 0]}
        scale={0.92}
      />
      <primitive object={lead} position={[0.07, -0.02, 0.05]} rotation={[1.15, Math.PI, 0.35]} scale={1.65} />
      <primitive object={off} position={[0.05, -0.2, 0.07]} rotation={[1.25, Math.PI * 0.92, 0.15]} scale={1.45} />
    </group>
  );
}

function Rig() {
  const { camera, gl } = useThree();
  const root = useRef<THREE.Group>(null);
  const yaw = useRef(0);
  const pitch = useRef(-0.08);
  const t = useRef(TOTAL);
  const swinging = useRef(false);
  const bias = useRef(0);
  const kick = useRef(0);
  const whooshed = useRef(false);
  const look = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const el = gl.domElement;
    const onMove = (e: MouseEvent) => {
      if (document.pointerLockElement !== el) return;
      look.current.x += e.movementX;
      look.current.y += e.movementY;
      if (swinging.current && t.current < WINDUP) {
        bias.current = THREE.MathUtils.clamp(bias.current + e.movementX * 0.004, -0.55, 0.55);
      }
    };
    const onDown = (e: MouseEvent) => {
      if (e.button !== 0) return;
      if (document.pointerLockElement !== el) {
        void el.requestPointerLock();
      }
      startSwing();
    };
    const onLock = () => setHud({ locked: document.pointerLockElement === el });
    const onTouch = (e: TouchEvent) => {
      if (e.touches.length === 1 && !swinging.current) startSwing();
    };
    let last: Touch | null = null;
    const onTouchMove = (e: TouchEvent) => {
      const touch = e.touches[0];
      if (!touch) return;
      if (last) {
        const dx = touch.clientX - last.clientX;
        const dy = touch.clientY - last.clientY;
        look.current.x += dx * 1.4;
        look.current.y += dy * 1.4;
      }
      last = touch;
    };
    const onTouchEnd = () => {
      last = null;
    };

    function startSwing() {
      if (swinging.current && t.current < TOTAL - 0.15) return;
      swinging.current = true;
      t.current = 0;
      bias.current = 0;
      whooshed.current = false;
      setHud({ phase: "armement" });
    }

    el.addEventListener("mousedown", onDown);
    document.addEventListener("mousemove", onMove);
    document.addEventListener("pointerlockchange", onLock);
    el.addEventListener("touchstart", onTouch, { passive: true });
    el.addEventListener("touchmove", onTouchMove, { passive: true });
    el.addEventListener("touchend", onTouchEnd);
    const onKey = (e: KeyboardEvent) => {
      if (e.code === "Escape") document.exitPointerLock();
    };
    window.addEventListener("keydown", onKey);
    (window as unknown as { __slash?: () => void }).__slash = startSwing;
    return () => {
      el.removeEventListener("mousedown", onDown);
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("pointerlockchange", onLock);
      el.removeEventListener("touchstart", onTouch);
      el.removeEventListener("touchmove", onTouchMove);
      el.removeEventListener("touchend", onTouchEnd);
      window.removeEventListener("keydown", onKey);
    };
  }, [gl]);

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.05);
    const sens = 0.0022;
    yaw.current -= look.current.x * sens;
    pitch.current -= look.current.y * sens;
    pitch.current = THREE.MathUtils.clamp(pitch.current, -1.15, 1.05);
    look.current.x = 0;
    look.current.y = 0;

    if (swinging.current) {
      t.current += dt;
      if (t.current >= WINDUP && !whooshed.current) {
        whooshed.current = true;
        const fast = bias.current > 0.18;
        playWhoosh(fast);
        setHud({ phase: "frappe" });
      }
      if (t.current >= WINDUP + RELEASE && t.current - dt < WINDUP + RELEASE) {
        kick.current = 0.045;
        setHud({ phase: "récupération" });
      }
      if (t.current >= TOTAL) {
        swinging.current = false;
        t.current = TOTAL;
        setHud({ phase: "prêt" });
      }
    }
    kick.current *= Math.exp(-dt * 14);

    camera.rotation.order = "YXZ";
    camera.rotation.y = yaw.current;
    camera.rotation.x = pitch.current - kick.current;

    const g = root.current;
    if (!g) return;

    let pose: Pose;
    const u = t.current;
    const swingScale = 1 + THREE.MathUtils.clamp(bias.current, -0.4, 0.45);
    if (!swinging.current) {
      pose = IDLE;
    } else if (u < WINDUP) {
      pose = lerpPose(IDLE, WIND, u / WINDUP);
    } else if (u < WINDUP + RELEASE) {
      const p = (u - WINDUP) / RELEASE;
      // Heavy start, snap through the middle — Chivalry release is the weighted arc.
      const shaped = p < 0.72 ? easeOut(p / 0.72) * 0.82 : 0.82 + ((p - 0.72) / 0.28) * 0.18;
      pose = lerpPose(WIND, STRIKE, shaped);
      pose.ry += bias.current * shaped;
      pose.x += bias.current * 0.15 * shaped;
    } else {
      const p = (u - WINDUP - RELEASE) / RECOVERY;
      pose = lerpPose(STRIKE, p < 0.45 ? FOLLOW : IDLE, p < 0.45 ? p / 0.45 : (p - 0.45) / 0.55);
    }
    g.position.set(pose.x, pose.y, pose.z);
    g.rotation.set(pose.rx, pose.ry * (swinging.current ? swingScale * 0.15 + 0.85 : 1), pose.rz);
  });

  return (
    <group ref={root}>
      <Suspense fallback={null}>
        <Viewmodel />
      </Suspense>
    </group>
  );
}

function House({ x, z, rot = 0, w = 4.2, d = 3.4 }: { x: number; z: number; rot?: number; w?: number; d?: number }) {
  return (
    <group position={[x, 0, z]} rotation={[0, rot, 0]}>
      <mesh position={[0, 1.5, 0]}>
        <boxGeometry args={[w, 3, d]} />
        <meshStandardMaterial color="#cbb89a" roughness={0.9} />
      </mesh>
      <mesh position={[0, 3.15, 0]} rotation={[0, 0, 0]}>
        <coneGeometry args={[w * 0.72, 1.6, 4]} />
        <meshStandardMaterial color="#6e2c24" roughness={0.85} />
      </mesh>
      <mesh position={[0, 1.15, d / 2 + 0.02]}>
        <boxGeometry args={[0.7, 1.5, 0.08]} />
        <meshStandardMaterial color="#3a2418" />
      </mesh>
      <mesh position={[-0.9, 1.7, d / 2 + 0.02]}>
        <boxGeometry args={[0.55, 0.7, 0.06]} />
        <meshStandardMaterial color="#f0c56e" emissive="#a86a22" emissiveIntensity={0.35} />
      </mesh>
      {[ -w / 2, w / 2 ].map((bx) => (
        <mesh key={bx} position={[bx, 1.5, 0]}>
          <boxGeometry args={[0.18, 3, d + 0.05]} />
          <meshStandardMaterial color="#4a301c" />
        </mesh>
      ))}
    </group>
  );
}

function Torch({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      <mesh position={[0, 0.7, 0]}>
        <cylinderGeometry args={[0.06, 0.08, 1.5, 6]} />
        <meshStandardMaterial color="#3a2a1c" />
      </mesh>
      <mesh position={[0, 1.55, 0]}>
        <sphereGeometry args={[0.12, 10, 8]} />
        <meshStandardMaterial color="#ffb15a" emissive="#ff6a1a" emissiveIntensity={2.2} />
      </mesh>
      <pointLight position={[0, 1.7, 0]} intensity={8} distance={9} color="#ff7a3a" />
    </group>
  );
}

function World() {
  const stones = useRef<THREE.InstancedMesh>(null);
  useEffect(() => {
    const mesh = stones.current;
    if (!mesh) return;
    const dummy = new THREE.Object3D();
    let i = 0;
    for (let z = -10; z <= 8; z += 0.62) {
      for (let x = -10; x <= 10; x += 0.62) {
        const jx = ((x * 13 + z * 7) % 5) * 0.03;
        dummy.position.set(x + jx, 0.03, z + ((z * 3) % 4) * 0.02);
        dummy.rotation.set(Math.PI / 2, 0, x * 0.4 + z);
        dummy.scale.set(0.34, 0.28, 0.05);
        dummy.updateMatrix();
        mesh.setMatrixAt(i++, dummy.matrix);
        if (i >= 700) break;
      }
      if (i >= 700) break;
    }
    mesh.count = i;
    mesh.instanceMatrix.needsUpdate = true;
  }, []);

  return (
    <>
      <color attach="background" args={["#14110e"]} />
      <fog attach="fog" args={["#14110e", 12, 42]} />
      <ambientLight intensity={0.16} />
      <hemisphereLight args={["#8aa0c0", "#3a2a1c", 0.35]} />
      <directionalLight position={[-8, 14, 6]} intensity={0.45} color="#b7c7e6" />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
        <circleGeometry args={[28, 40]} />
        <meshStandardMaterial color="#3a342c" roughness={1} />
      </mesh>
      <instancedMesh ref={stones} args={[undefined, undefined, 700]}>
        <cylinderGeometry args={[1, 0.92, 1, 5]} />
        <meshStandardMaterial color="#6a6458" roughness={0.95} />
      </instancedMesh>
      {[-12, 12].map((x) => (
        <mesh key={x} position={[x, 1.6, 0]}>
          <boxGeometry args={[1.1, 3.2, 26]} />
          <meshStandardMaterial color="#7a7368" roughness={0.92} />
        </mesh>
      ))}
      <mesh position={[0, 1.8, -12]}>
        <boxGeometry args={[26, 3.6, 1.2]} />
        <meshStandardMaterial color="#7a7368" roughness={0.92} />
      </mesh>
      <mesh position={[0, 2.4, -12]}>
        <boxGeometry args={[3.2, 2.2, 1.4]} />
        <meshStandardMaterial color="#5c564c" />
      </mesh>
      {Array.from({ length: 8 }, (_, i) => -10 + i * 3).map((x) => (
        <mesh key={x} position={[x, 3.5, -12]}>
          <boxGeometry args={[1.1, 0.7, 1.3]} />
          <meshStandardMaterial color="#6d665c" />
        </mesh>
      ))}
      <House x={-7.5} z={-7} rot={0.2} />
      <House x={7.2} z={-6.5} rot={-0.4} w={5} />
      <House x={-8} z={4.5} rot={1.1} w={3.6} d={3} />
      <House x={8.2} z={5} rot={-1.2} />
      <group position={[2.4, 0, 3.2]}>
        <mesh position={[0, 0.45, 0]}>
          <cylinderGeometry args={[0.9, 1.05, 0.9, 10]} />
          <meshStandardMaterial color="#6d675d" />
        </mesh>
        <mesh position={[0, 1.15, 0]}>
          <cylinderGeometry args={[0.18, 0.22, 0.7, 8]} />
          <meshStandardMaterial color="#3d2c1e" />
        </mesh>
        <mesh position={[0, 1.35, 0]} rotation={[0.2, 0, 0.4]}>
          <boxGeometry args={[1.3, 0.08, 0.12]} />
          <meshStandardMaterial color="#5a4030" />
        </mesh>
      </group>
      {[[-4, 1.2, -3], [5, 1.2, 1.5], [-2, 1.2, 6], [3.5, 1.2, -5], [-6, 1.2, -1]].map((p, i) => (
        <Torch key={i} position={p as [number, number, number]} />
      ))}
      <mesh position={[0, 0.35, -4]} rotation={[0, 0.4, 0]}>
        <boxGeometry args={[1.6, 0.7, 0.8]} />
        <meshStandardMaterial color="#5a3a22" />
      </mesh>
      <mesh position={[0.9, 0.55, -3.6]}>
        <cylinderGeometry args={[0.28, 0.32, 0.9, 8]} />
        <meshStandardMaterial color="#6a4a2a" />
      </mesh>
    </>
  );
}

export function Arena() {
  return (
    <Canvas
      camera={{ fov: 78, near: 0.05, far: 80, position: [0, 1.65, 0] }}
      gl={{ antialias: true }}
      dpr={[1, 1.75]}
      style={{ width: "100%", height: "100%", touchAction: "none" }}
    >
      <World />
      <Rig />
    </Canvas>
  );
}
