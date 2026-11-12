import { useGLTF } from "@react-three/drei";
import { Suspense, useEffect, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { setHud } from "./hud";
import { playWhoosh } from "./whoosh";

const WINDUP = 0.225;
const RELEASE = 0.475;
const RECOVERY = 0.8;
const TOTAL = WINDUP + RELEASE + RECOVERY;

type Pose = { x: number; y: number; z: number; rx: number; ry: number; rz: number };

const IDLE: Pose = { x: 0.32, y: -0.38, z: -0.62, rx: -0.55, ry: 0.42, rz: -0.15 };
const WIND: Pose = { x: 0.48, y: -0.12, z: -0.38, rx: 0.85, ry: -0.95, rz: 0.95 };
const STRIKE: Pose = { x: -0.22, y: -0.48, z: -0.78, rx: -0.15, ry: 1.25, rz: -1.35 };
const FOLLOW: Pose = { x: -0.08, y: -0.55, z: -0.55, rx: 0.15, ry: 0.7, rz: -0.55 };

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
  return (
    <group>
      <primitive
        object={hand.scene}
        position={[0.02, -0.34, 0.04]}
        rotation={[0.55, Math.PI, 0.15]}
        scale={1.25}
      />
      <primitive
        object={sword.scene}
        position={[0, 0.05, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
        scale={1.05}
      />
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

function World() {
  return (
    <>
      <color attach="background" args={["#0c0e12"]} />
      <fog attach="fog" args={["#0c0e12", 6, 28]} />
      <ambientLight intensity={0.55} />
      <directionalLight position={[4, 8, 2]} intensity={1.35} color="#f0e2c8" />
      <pointLight position={[-3.2, 1.1, -4]} intensity={6} distance={10} color="#ff6a2a" />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
        <planeGeometry args={[80, 80]} />
        <meshStandardMaterial color="#16181c" roughness={1} />
      </mesh>
      <gridHelper args={[40, 40, "#2a241c", "#1c1e22"]} position={[0, 0.01, 0]} />
      {[-6, -2, 2, 6].map((x) => (
        <mesh key={x} position={[x, 1.4, -8]}>
          <cylinderGeometry args={[0.08, 0.1, 2.8, 8]} />
          <meshStandardMaterial color="#2c241c" roughness={0.9} />
        </mesh>
      ))}
      <mesh position={[-3.2, 0.35, -4]}>
        <cylinderGeometry args={[0.35, 0.4, 0.7, 10]} />
        <meshStandardMaterial color="#3a2a22" roughness={0.8} />
      </mesh>
      <mesh position={[-3.2, 0.85, -4]}>
        <sphereGeometry args={[0.18, 12, 10]} />
        <meshStandardMaterial color="#ff7a33" emissive="#ff4a10" emissiveIntensity={2} />
      </mesh>
    </>
  );
}

export function Arena() {
  return (
    <Canvas
      camera={{ fov: 90, near: 0.05, far: 60, position: [0, 1.65, 0] }}
      gl={{ antialias: true }}
      dpr={[1, 1.75]}
      style={{ width: "100%", height: "100%", touchAction: "none" }}
    >
      <World />
      <Rig />
    </Canvas>
  );
}
