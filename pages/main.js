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
scene.background = new THREE.Color("#c96b62");
scene.fog = new THREE.Fog("#e7b07a", 24, 80);
const camera = new THREE.PerspectiveCamera(78, 1, 0.05, 80);
camera.position.set(0, 1.65, 0);
camera.rotation.order = "YXZ";

scene.add(new THREE.AmbientLight(0xffffff, 0.55));
scene.add(new THREE.HemisphereLight(0xffd2a4, 0x5f8a48, 0.7));
const sun = new THREE.DirectionalLight(0xffb15a, 1.8);
sun.position.set(18, 10, -12);
scene.add(sun);
const rim = new THREE.DirectionalLight(0x8eb4ff, 0.45);
rim.position.set(-14, 16, 18);
scene.add(rim);

const dirt = new THREE.Mesh(
  new THREE.PlaneGeometry(200, 200),
  new THREE.MeshStandardMaterial({ color: 0x6d8f4a, roughness: 1 }),
);
dirt.rotation.x = -Math.PI / 2;
scene.add(dirt);
const path = new THREE.Mesh(
  new THREE.PlaneGeometry(6, 40),
  new THREE.MeshStandardMaterial({ color: 0xc6a56e, roughness: 0.95 }),
);
path.rotation.x = -Math.PI / 2;
path.position.set(0, 0.02, 2);
scene.add(path);
scene.background = new THREE.Color("#c96b62");
scene.fog = new THREE.Fog("#e7b07a", 24, 80);

const loader = new GLTFLoader();
function prop(file, x, y, z, rotY = 0, yLift = 0) {
  loader.load("./models/" + file, (gltf) => {
    const o = gltf.scene;
    o.position.set(x, yLift, z);
    o.rotation.y = rotY;
    scene.add(o);
  });
}
prop("castle.glb", 0, 0, -42);
prop("stone-house.glb", -16, 0, -10, 0.5);
prop("timber-frame-house.glb", 15, 0, -8, -0.6);
prop("thatched-cottage.glb", -18, 0, 10, 1.1);
prop("blacksmith-forge.glb", 14, 0, 9, -1.4);
prop("wooden-watchtower.glb", -22, 0, -1, 0.3);
prop("tournament-stand.glb", 0, 0, 16, Math.PI);
prop("ballista.glb", 6, 0, -3, -0.4, 0.5);
prop("catapult.glb", -7, 0, 2, 0.8, 0.45);
for (const z of [-8, -4, 0, 4, 8]) {
  prop("wooden-palisade.glb", -24, 0, z, Math.PI / 2);
  prop("wooden-palisade.glb", 24, 0, z, -Math.PI / 2);
}
[[-14, 3, 8], [14, 3, 8], [0, 8, -30]].forEach(([x, y, z]) => {
  const light = new THREE.PointLight(0xff7a3a, x === 0 ? 10 : 16, x === 0 ? 30 : 16);
  light.position.set(x, y, z);
  scene.add(light);
});

const rig = new THREE.Group();
camera.add(rig);
scene.add(camera);

const weaponLoader = new GLTFLoader();
weaponLoader.load("./models/gauntlet.glb", (gltf) => {
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
weaponLoader.load("./models/fantasy-sword.glb", (gltf) => {
  const sword = gltf.scene;
  sword.position.set(0, 0.18, 0);
  sword.rotation.set(-Math.PI / 2, Math.PI, 0);
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
