import * as THREE from "https://esm.sh/three@0.187.0";
import { GLTFLoader } from "https://esm.sh/three@0.187.0/examples/jsm/loaders/GLTFLoader.js";

const WINDUP = 0.225;
const RELEASE = 0.475;
const RECOVERY = 0.8;
const TOTAL = WINDUP + RELEASE + RECOVERY;

const IDLE = { x: 0.32, y: -0.38, z: -0.62, rx: -0.55, ry: 0.42, rz: -0.15 };
const WIND = { x: 0.48, y: -0.12, z: -0.38, rx: 0.85, ry: -0.95, rz: 0.95 };
const STRIKE = { x: -0.22, y: -0.48, z: -0.78, rx: -0.15, ry: 1.25, rz: -1.35 };
const FOLLOW = { x: -0.08, y: -0.55, z: -0.55, rx: 0.15, ry: 0.7, rz: -0.55 };

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
scene.background = new THREE.Color("#0c0e12");
scene.fog = new THREE.Fog("#0c0e12", 6, 28);
const camera = new THREE.PerspectiveCamera(90, 1, 0.05, 60);
camera.position.set(0, 1.65, 0);
camera.rotation.order = "YXZ";

scene.add(new THREE.AmbientLight(0xffffff, 0.55));
const sun = new THREE.DirectionalLight(0xf0e2c8, 1.35);
sun.position.set(4, 8, 2);
scene.add(sun);
const fire = new THREE.PointLight(0xff6a2a, 6, 10);
fire.position.set(-3.2, 1.1, -4);
scene.add(fire);

const ground = new THREE.Mesh(
  new THREE.PlaneGeometry(80, 80),
  new THREE.MeshStandardMaterial({ color: 0x16181c, roughness: 1 }),
);
ground.rotation.x = -Math.PI / 2;
scene.add(ground);
scene.add(new THREE.GridHelper(40, 40, 0x2a241c, 0x1c1e22));

for (const x of [-6, -2, 2, 6]) {
  const post = new THREE.Mesh(
    new THREE.CylinderGeometry(0.08, 0.1, 2.8, 8),
    new THREE.MeshStandardMaterial({ color: 0x2c241c, roughness: 0.9 }),
  );
  post.position.set(x, 1.4, -8);
  scene.add(post);
}
const brazier = new THREE.Mesh(
  new THREE.CylinderGeometry(0.35, 0.4, 0.7, 10),
  new THREE.MeshStandardMaterial({ color: 0x3a2a22, roughness: 0.8 }),
);
brazier.position.set(-3.2, 0.35, -4);
scene.add(brazier);
const flame = new THREE.Mesh(
  new THREE.SphereGeometry(0.18, 12, 10),
  new THREE.MeshStandardMaterial({ color: 0xff7a33, emissive: 0xff4a10, emissiveIntensity: 2 }),
);
flame.position.set(-3.2, 0.85, -4);
scene.add(flame);

const rig = new THREE.Group();
camera.add(rig);
scene.add(camera);

const loader = new GLTFLoader();
loader.load("./models/gauntlet.glb", (gltf) => {
  const hand = gltf.scene;
  hand.position.set(0.02, -0.34, 0.04);
  hand.rotation.set(0.55, Math.PI, 0.15);
  hand.scale.setScalar(1.25);
  rig.add(hand);
});
loader.load("./models/fantasy-sword.glb", (gltf) => {
  const sword = gltf.scene;
  sword.position.set(0, 0.05, 0);
  sword.rotation.set(-Math.PI / 2, 0, 0);
  sword.scale.setScalar(1.05);
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
