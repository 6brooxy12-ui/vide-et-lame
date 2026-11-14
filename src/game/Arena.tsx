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
        position={[0, 0.18, 0]}
        rotation={[-Math.PI / 2, Math.PI, 0]}
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

function Prop({
  url,
  position,
  rotation = [0, 0, 0],
  scale = 1,
}: {
  url: string;
  position: [number, number, number];
  rotation?: [number, number, number];
  scale?: number;
}) {
  const gltf = useGLTF(url);
  const obj = useMemo(() => gltf.scene.clone(true), [gltf.scene]);
  return <primitive object={obj} position={position} rotation={rotation} scale={scale} />;
}

function World() {
  return (
    <>
      <color attach="background" args={["#e7b07a"]} />
      <fog attach="fog" args={["#e7b07a", 24, 80]} />
      <ambientLight intensity={0.55} />
      <hemisphereLight args={["#ffd2a4", "#5f8a48", 0.7]} />
      <directionalLight position={[18, 10, -12]} intensity={1.8} color="#ffb15a" />
      <directionalLight position={[-14, 16, 18]} intensity={0.45} color="#8eb4ff" />
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[200, 200]} />
        <meshStandardMaterial color="#6d8f4a" roughness={1} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 2]}>
        <planeGeometry args={[6, 40]} />
        <meshStandardMaterial color="#c6a56e" roughness={0.95} />
      </mesh>
      <Prop url="/models/castle.glb" position={[0, 0, -42]} />
      <Prop url="/models/stone-house.glb" position={[-16, 0, -10]} rotation={[0, 0.5, 0]} />
      <Prop url="/models/timber-frame-house.glb" position={[15, 0, -8]} rotation={[0, -0.6, 0]} />
      <Prop url="/models/thatched-cottage.glb" position={[-18, 0, 10]} rotation={[0, 1.1, 0]} />
      <Prop url="/models/blacksmith-forge.glb" position={[14, 0, 9]} rotation={[0, -1.4, 0]} />
      <Prop url="/models/wooden-watchtower.glb" position={[-22, 0, -1]} rotation={[0, 0.3, 0]} />
      <Prop url="/models/tournament-stand.glb" position={[0, 0, 16]} rotation={[0, Math.PI, 0]} />
      <Prop url="/models/ballista.glb" position={[6, 0.5, -3]} rotation={[0, -0.4, 0]} />
      <Prop url="/models/catapult.glb" position={[-7, 0.45, 2]} rotation={[0, 0.8, 0]} />
      {[-8, -4, 0, 4, 8].map((z) => (
        <Prop key={`l${z}`} url="/models/wooden-palisade.glb" position={[-24, 0, z]} rotation={[0, Math.PI / 2, 0]} />
      ))}
      {[-8, -4, 0, 4, 8].map((z) => (
        <Prop key={`r${z}`} url="/models/wooden-palisade.glb" position={[24, 0, z]} rotation={[0, -Math.PI / 2, 0]} />
      ))}
      <pointLight position={[-14, 3, 8]} intensity={18} distance={16} color="#ff7a3a" />
      <pointLight position={[14, 3, 8]} intensity={14} distance={14} color="#ff9340" />
      <pointLight position={[0, 8, -30]} intensity={10} distance={30} color="#ffb060" />
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
