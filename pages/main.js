import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

const WINDUP = 0.225;
const RELEASE = 0.475;
const RECOVERY = 0.8;
const TOTAL = WINDUP + RELEASE + RECOVERY;

const IDLE = { x: 0.18, y: -0.32, z: -0.48, rx: -0.2, ry: 0.18, rz: -0.08 };
const WIND = { x: 0.42, y: -0.05, z: -0.32, rx: 0.72, ry: -0.85, rz: 0.7 };
const STRIKE = { x: -0.28, y: -0.36, z: -0.62, rx: -0.95, ry: 0.55, rz: -1.15 };
const FOLLOW = { x: -0.12, y: -0.48, z: -0.42, rx: -0.35, ry: 0.35, rz: -0.45 };

function lerpPose(a, b, t) {
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

const canvas = document.getElementById("view");
const phaseEl = document.getElementById("phase");
const hintEl = document.getElementById("hint");
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
const scene = new THREE.Scene();
scene.background = new THREE.Color("#14110e");
scene.fog = new THREE.Fog("#14110e", 12, 42);
const camera = new THREE.PerspectiveCamera(78, 1, 0.05, 80);
camera.position.set(0, 1.65, 0);
camera.rotation.order = "YXZ";

scene.add(new THREE.AmbientLight(0xffffff, 0.16));
scene.add(new THREE.HemisphereLight(0x8aa0c0, 0x3a2a1c, 0.35));
const moon = new THREE.DirectionalLight(0xb7c7e6, 0.45);
moon.position.set(-8, 14, 6);
scene.add(moon);

const stone = new THREE.MeshStandardMaterial({ color: 0x6a6458, roughness: 0.95 });
const wallMat = new THREE.MeshStandardMaterial({ color: 0x7a7368, roughness: 0.92 });
const plaster = new THREE.MeshStandardMaterial({ color: 0xcbb89a, roughness: 0.9 });
const timber = new THREE.MeshStandardMaterial({ color: 0x4a301c, roughness: 0.8 });
const roof = new THREE.MeshStandardMaterial({ color: 0x6e2c24, roughness: 0.85 });
const dirt = new THREE.Mesh(
  new THREE.CircleGeometry(28, 40),
  new THREE.MeshStandardMaterial({ color: 0x3a342c, roughness: 1 }),
);
dirt.rotation.x = -Math.PI / 2;
scene.add(dirt);

const cobble = new THREE.InstancedMesh(new THREE.CylinderGeometry(1, 0.92, 1, 5), stone, 700);
const dummy = new THREE.Object3D();
let n = 0;
for (let z = -10; z <= 8 && n < 700; z += 0.62) {
  for (let x = -10; x <= 10 && n < 700; x += 0.62) {
    dummy.position.set(x + ((x * 13 + z * 7) % 5) * 0.03, 0.03, z);
    dummy.rotation.set(Math.PI / 2, 0, x * 0.4 + z);
    dummy.scale.set(0.34, 0.28, 0.05);
    dummy.updateMatrix();
    cobble.setMatrixAt(n++, dummy.matrix);
  }
}
cobble.count = n;
cobble.instanceMatrix.needsUpdate = true;
scene.add(cobble);

function wall(x, y, z, w, h, d) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), wallMat);
  m.position.set(x, y, z);
  scene.add(m);
}
wall(-12, 1.6, 0, 1.1, 3.2, 26);
wall(12, 1.6, 0, 1.1, 3.2, 26);
wall(0, 1.8, -12, 26, 3.6, 1.2);
wall(0, 2.4, -12, 3.2, 2.2, 1.4);
for (let i = 0; i < 8; i++) wall(-10 + i * 3, 3.5, -12, 1.1, 0.7, 1.3);

function house(x, z, rot, w, d) {
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  g.rotation.y = rot;
  const body = new THREE.Mesh(new THREE.BoxGeometry(w, 3, d), plaster);
  body.position.y = 1.5;
  const top = new THREE.Mesh(new THREE.ConeGeometry(w * 0.72, 1.6, 4), roof);
  top.position.y = 3.15;
  const door = new THREE.Mesh(new THREE.BoxGeometry(0.7, 1.5, 0.08), timber);
  door.position.set(0, 1.15, d / 2 + 0.02);
  const win = new THREE.Mesh(
    new THREE.BoxGeometry(0.55, 0.7, 0.06),
    new THREE.MeshStandardMaterial({ color: 0xf0c56e, emissive: 0xa86a22, emissiveIntensity: 0.35 }),
  );
  win.position.set(-0.9, 1.7, d / 2 + 0.02);
  g.add(body, top, door, win);
  for (const bx of [-w / 2, w / 2]) {
    const beam = new THREE.Mesh(new THREE.BoxGeometry(0.18, 3, d + 0.05), timber);
    beam.position.set(bx, 1.5, 0);
    g.add(beam);
  }
  scene.add(g);
}
house(-7.5, -7, 0.2, 4.2, 3.4);
house(7.2, -6.5, -0.4, 5, 3.4);
house(-8, 4.5, 1.1, 3.6, 3);
house(8.2, 5, -1.2, 4.2, 3.4);

function torch(x, y, z) {
  const post = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 1.5, 6), timber);
  post.position.set(x, y + 0.7, z);
  const flame = new THREE.Mesh(
    new THREE.SphereGeometry(0.12, 10, 8),
    new THREE.MeshStandardMaterial({ color: 0xffb15a, emissive: 0xff6a1a, emissiveIntensity: 2.2 }),
  );
  flame.position.set(x, y + 1.55, z);
  const light = new THREE.PointLight(0xff7a3a, 8, 9);
  light.position.set(x, y + 1.7, z);
  scene.add(post, flame, light);
}
[[-4, 0, -3], [5, 0, 1.5], [-2, 0, 6], [3.5, 0, -5], [-6, 0, -1]].forEach((p) => torch(...p));

const well = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 1.05, 0.9, 10), wallMat);
well.position.set(2.4, 0.45, 3.2);
scene.add(well);
const crate = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.7, 0.8), timber);
crate.position.set(0, 0.35, -4);
crate.rotation.y = 0.4;
scene.add(crate);
const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.32, 0.9, 8), new THREE.MeshStandardMaterial({ color: 0x6a4a2a }));
barrel.position.set(0.9, 0.55, -3.6);
scene.add(barrel);

const rig = new THREE.Group();
camera.add(rig);
scene.add(camera);

const loader = new GLTFLoader();
loader.load("./models/gauntlet.glb", (gltf) => {
  const lead = gltf.scene.clone(true);
  lead.position.set(0.07, -0.02, 0.05);
  lead.rotation.set(1.15, Math.PI, 0.35);
  lead.scale.setScalar(1.65);
  rig.add(lead);
  const off = gltf.scene.clone(true);
  off.position.set(0.05, -0.2, 0.07);
  off.rotation.set(1.25, Math.PI * 0.92, 0.15);
  off.scale.setScalar(1.45);
  rig.add(off);
});
loader.load("./models/fantasy-sword.glb", (gltf) => {
  const sword = gltf.scene;
  sword.position.set(0, 0.42, 0);
  sword.rotation.set(Math.PI / 2, Math.PI, 0);
  sword.scale.setScalar(0.92);
  rig.add(sword);
});

let yaw = 0;
let pitch = -0.08;
let t = TOTAL;
let swinging = false;
let bias = 0;
let kick = 0;
let whooshed = false;
const look = { x: 0, y: 0 };
let audioCtx = null;

function playWhoosh(fast) {
  const audio = audioCtx || (audioCtx = new AudioContext());
  if (audio.state === "suspended") void audio.resume();
  const now = audio.currentTime;
  const dur = fast ? 0.28 : 0.42;
  const osc = audio.createOscillator();
  const gain = audio.createGain();
  const filter = audio.createBiquadFilter();
  osc.type = "sawtooth";
  osc.frequency.setValueAtTime(fast ? 220 : 140, now);
  osc.frequency.exponentialRampToValueAtTime(fast ? 70 : 48, now + dur);
  filter.type = "bandpass";
  filter.frequency.setValueAtTime(900, now);
  filter.frequency.exponentialRampToValueAtTime(280, now + dur);
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(0.08, now + 0.04);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + dur);
  osc.connect(filter);
  filter.connect(gain);
  gain.connect(audio.destination);
  osc.start(now);
  osc.stop(now + dur + 0.02);
}

function setPhase(name) {
  phaseEl.textContent = name;
}

function startSwing() {
  if (swinging && t < TOTAL - 0.15) return;
  swinging = true;
  t = 0;
  bias = 0;
  whooshed = false;
  setPhase("Armement");
}

canvas.addEventListener("mousedown", (e) => {
  if (e.button !== 0) return;
  if (document.pointerLockElement !== canvas) void canvas.requestPointerLock();
  startSwing();
});
document.addEventListener("mousemove", (e) => {
  if (document.pointerLockElement !== canvas) return;
  look.x += e.movementX;
  look.y += e.movementY;
  if (swinging && t < WINDUP) bias = THREE.MathUtils.clamp(bias + e.movementX * 0.004, -0.55, 0.55);
  hintEl.textContent = "Souris pour viser. Clic gauche pour frapper. Pendant l'armement, accompagne le coup.";
});
document.addEventListener("pointerlockchange", () => {
  if (document.pointerLockElement === canvas) {
    hintEl.textContent = "Souris pour viser. Clic gauche pour frapper. Pendant l'armement, accompagne le coup.";
  }
});
let lastTouch = null;
canvas.addEventListener("touchstart", (e) => {
  if (e.touches.length === 1) startSwing();
}, { passive: true });
canvas.addEventListener("touchmove", (e) => {
  const touch = e.touches[0];
  if (lastTouch && touch) {
    look.x += (touch.clientX - lastTouch.clientX) * 1.4;
    look.y += (touch.clientY - lastTouch.clientY) * 1.4;
  }
  lastTouch = touch || null;
}, { passive: true });
canvas.addEventListener("touchend", () => {
  lastTouch = null;
});
document.getElementById("strike").addEventListener("click", startSwing);

function resize() {
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / Math.max(h, 1);
  camera.updateProjectionMatrix();
}
addEventListener("resize", resize);
resize();

let last = performance.now();
function frame(now) {
  const dt = Math.min((now - last) / 1000, 0.05);
  last = now;
  yaw -= look.x * 0.0022;
  pitch -= look.y * 0.0022;
  pitch = THREE.MathUtils.clamp(pitch, -1.15, 1.05);
  look.x = 0;
  look.y = 0;
  if (swinging) {
    t += dt;
    if (t >= WINDUP && !whooshed) {
      whooshed = true;
      playWhoosh(bias > 0.18);
      setPhase("Frappe");
    }
    if (t >= WINDUP + RELEASE && t - dt < WINDUP + RELEASE) {
      kick = 0.045;
      setPhase("Récupération");
    }
    if (t >= TOTAL) {
      swinging = false;
      t = TOTAL;
      setPhase("Prêt");
    }
  }
  kick *= Math.exp(-dt * 14);
  camera.rotation.y = yaw;
  camera.rotation.x = pitch - kick;

  let pose = IDLE;
  if (swinging && t < WINDUP) pose = lerpPose(IDLE, WIND, t / WINDUP);
  else if (swinging && t < WINDUP + RELEASE) {
    const p = (t - WINDUP) / RELEASE;
    const shaped = p < 0.72 ? (1 - (1 - p / 0.72) ** 2) * 0.82 : 0.82 + ((p - 0.72) / 0.28) * 0.18;
    pose = lerpPose(WIND, STRIKE, shaped);
    pose.ry += bias * shaped;
    pose.x += bias * 0.15 * shaped;
  } else if (swinging) {
    const p = (t - WINDUP - RELEASE) / RECOVERY;
    pose = lerpPose(STRIKE, p < 0.45 ? FOLLOW : IDLE, p < 0.45 ? p / 0.45 : (p - 0.45) / 0.55);
  }
  rig.position.set(pose.x, pose.y, pose.z);
  rig.rotation.set(pose.rx, pose.ry, pose.rz);
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
