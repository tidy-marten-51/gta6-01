// SOLMAR BAY — main entry point. Boots the three.js scene, owns the game
// loop, the player (on foot and driving), shooting, the wanted system,
// day/night lighting and the menu/pause/game-over flow. All systems live
// in the sibling modules; this file wires them together.
import * as THREE from 'three';
import { createGameState, clamp, dist2d, hasSave, loadGame, saveGame } from './state.js';
import { buildCity, resolveBuildingCollision } from './city.js';
import { spawnVehicles, nearestCar, updateDriving, updateTraffic, updatePoliceCars } from './vehicles.js';
import { spawnPedestrians, updatePedestrians, updatePoliceOnFoot, addHeat, makePersonMesh } from './people.js';
import { buildBeacon, updateBeacon, updateMissions, startMission, currentMission } from './missions.js';
import { makeHud, updateHud, renderScreen, showToast } from './hud.js';
import { SoundBank } from './audio.js';
import { bindInput, consumeMouse } from './input.js';
import { applyShot, settleWorld } from './shots.js';

const params = new URLSearchParams(location.search);
const seed = Number(params.get('seed') || 7) || 7;
const shotName = params.get('shot');
const G = createGameState(seed);
const sound = new SoundBank();
const hud = makeHud();
const screenEl = document.getElementById('screen');
const canvas = document.getElementById('game');

// --- Renderer, scene, camera, lights -------------------------------------
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87b5d6);
scene.fog = new THREE.Fog(0x87b5d6, 120, 420);
const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 900);
const sun = new THREE.DirectionalLight(0xfff2d0, 1.6);
sun.position.set(80, 140, 40);
scene.add(sun);
const hemi = new THREE.HemisphereLight(0xbcd8ff, 0x5a7a4a, 0.9);
scene.add(hemi);
const ambient = new THREE.AmbientLight(0xffffff, 0.25);
scene.add(ambient);

buildCity(scene, G);
spawnVehicles(scene, G);
spawnPedestrians(scene, G, 26);
const beacon = buildBeacon(scene);

// Player on-foot mesh (hidden while driving).
const playerMesh = makePersonMesh(0x27ae60, 0xf1c27d, false);
playerMesh.visible = true;
scene.add(playerMesh);

// --- Day / night presets ---------------------------------------------------
function applyTimeOfDay(preset) {
  if (preset === 'night') {
    scene.background.set(0x0a1024);
    scene.fog.color.set(0x0a1024);
    sun.intensity = 0.45; sun.color.set(0x8fa8ff);
    hemi.intensity = 0.45; ambient.intensity = 0.55;
  } else if (preset === 'dusk') {
    scene.background.set(0xe88a4a);
    scene.fog.color.set(0xe88a4a);
    sun.intensity = 1.1; sun.color.set(0xffb36b);
    sun.position.set(-120, 50, 60);
    hemi.intensity = 0.55; ambient.intensity = 0.25;
  } else {
    scene.background.set(0x87b5d6);
    scene.fog.color.set(0x87b5d6);
    sun.intensity = 1.6; sun.color.set(0xfff2d0);
    sun.position.set(80, 140, 40);
    hemi.intensity = 0.9; ambient.intensity = 0.25;
  }
}

// --- Shooting ---------------------------------------------------------------
function shoot() {
  if (G.mode !== 'playing' || !G.player.onFoot || G.shootCooldown > 0) return;
  G.shootCooldown = 0.35;
  G.stats.shotsFired += 1;
  G.lastShotAt = G.elapsed;
  sound.ensure(); sound.gunshot();
  // Hitscan: nearest pedestrian or officer roughly in front of the camera.
  const fx = Math.sin(G.cameraYaw), fz = Math.cos(G.cameraYaw);
  let best = null, bestD = 42;
  const targets = [];
  for (const ped of G.peds) if (ped.state !== 'down') targets.push({ kind: 'ped', obj: ped });
  for (const cop of G.police) targets.push({ kind: 'cop', obj: cop });
  for (const t of targets) {
    const dx = t.obj.x - G.player.x, dz = t.obj.z - G.player.z;
    const d = Math.hypot(dx, dz);
    if (d > bestD || d < 0.5) continue;
    const dot = (dx * fx + dz * fz) / d;
    if (dot > 0.92) { best = t; bestD = d; }
  }
  if (best) {
    if (best.kind === 'ped') {
      best.obj.state = 'down'; best.obj.downTimer = 8;
      best.obj.mesh.position.y = 0.4;
      addHeat(G, 18, 'You shot a pedestrian!');
    } else {
      scene.remove(best.obj.mesh);
      G.police.splice(G.police.indexOf(best.obj), 1);
      addHeat(G, 25, 'You shot an officer! The heat is on!');
    }
  } else {
    addHeat(G, 2);
  }
}

// --- Entering / exiting cars -------------------------------------------------
function tryEnterCar() {
  if (G.mode !== 'playing') return;
  const p = G.player;
  if (p.onFoot) {
    const car = nearestCar(G, p.x, p.z, 4.5);
    if (!car) return;
    car.parked = false; car.stolen = true;
    p.car = car; p.onFoot = false;
    playerMesh.visible = false;
    G.stats.carsStolen += 1;
    addHeat(G, 12, `You stole the ${car.name}!`);
    sound.ensure(); sound.pickup();
    showToast(hud, `🚗 ${car.name} — yours now. Drive!`, 2);
  } else if (p.car) {
    const car = p.car;
    // Step out beside the car, clear of traffic.
    p.x = car.x + Math.cos(car.yaw) * 3;
    p.z = car.z - Math.sin(car.yaw) * 3;
    p.onFoot = true; p.car = null; p.speed = 0;
    car.speed = 0;
    playerMesh.visible = true;
    playerMesh.position.set(p.x, 0, p.z);
  }
}

// --- Screen flow ---------------------------------------------------------------
function showMenu() {
  G.mode = 'menu';
  renderScreen(G, screenEl, 'menu', {
    hasSave: hasSave(),
    onPlay: (cont) => {
      if (cont) loadGame(G);
      else { G.money = 250; G.health = 100; G.rep = 0; G.missionIndex = 0; G.missionStep = 0; G.stats = { carsStolen: 0, missionsDone: 0, pedsHit: 0, shotsFired: 0 }; }
      startMission(G, G.missionIndex);
      G.mode = 'playing';
      renderScreen(G, screenEl, 'hidden', {});
      sound.ensure();
      showToast(hud, currentMission(G) ? currentMission(G).intro : 'Free roam — Solmar Bay is yours.', 4);
    },
  });
}

function pauseGame() {
  if (G.mode === 'playing') {
    G.mode = 'paused';
    if (document.pointerLockElement) document.exitPointerLock();
    renderScreen(G, screenEl, 'paused', {
      onResume: () => { G.mode = 'playing'; renderScreen(G, screenEl, 'hidden', {}); },
      onSave: () => { saveGame(G); showToast(hud, '💾 Game saved.', 2); },
    });
  } else if (G.mode === 'paused') {
    G.mode = 'playing';
    renderScreen(G, screenEl, 'hidden', {});
  }
}

bindInput(G, canvas, {
  onEnterCar: tryEnterCar,
  onShoot: shoot,
  onPause: pauseGame,
  onMute: () => { sound.ensure(); const m = sound.toggleMute(); showToast(hud, m ? '🔇 Muted' : '🔊 Sound on', 1.5); },
  onRestartMission: () => {
    if (G.mode !== 'playing') return;
    startMission(G, G.missionIndex);
    G.message = 'Mission restarted: ' + (currentMission(G) ? currentMission(G).title : '');
    G.messageUntil = G.elapsed + 2;
  },
});

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// --- Per-frame world update ----------------------------------------------------
function updateWorld(dt, settling) {
  G.elapsed += dt;
  G.clockMin = (G.clockMin + dt * 0.6) % (24 * 60); // a game hour every 100 s
  // Mouse look.
  const { dx, dy } = consumeMouse(G);
  G.cameraYaw -= dx * 0.0032;
  G.cameraPitch = clamp(G.cameraPitch + dy * 0.0022, 0.05, 1.1);
  const p = G.player;
  const k = G.keys;
  // Screenshot mode: keep the staged chase / mission car driving itself
  // down its road so the shot shows motion, not a parked car.
  if (G.shot === 'chase' || G.shot === 'mission') k.KeyW = true;

  if (p.onFoot) {
    // On-foot movement, camera-relative.
    const fwd = (k.KeyW || k.ArrowUp ? 1 : 0) - (k.KeyS || k.ArrowDown ? 1 : 0);
    const strafe = (k.KeyD || k.ArrowRight ? 1 : 0) - (k.KeyA || k.ArrowLeft ? 1 : 0);
    const fx = Math.sin(G.cameraYaw), fz = Math.cos(G.cameraYaw);
    const rx = Math.cos(G.cameraYaw), rz = -Math.sin(G.cameraYaw);
    const speed = (k.ShiftLeft || k.ShiftRight) ? 8.5 : 5;
    let mx = (fx * fwd + rx * strafe) * speed;
    let mz = (fz * fwd + rz * strafe) * speed;
    const len = Math.hypot(mx, mz);
    if (len > 0) { mx /= len; mz /= len; mx *= speed; mz *= speed; p.yaw = Math.atan2(mx, mz); p.moving = true; }
    else p.moving = false;
    p.x += mx * dt; p.z += mz * dt;
    p.x = clamp(p.x, -170, 175); p.z = clamp(p.z, -170, 170);
    const pos = { x: p.x, z: p.z };
    resolveBuildingCollision(G, pos, 0.7);
    p.x = pos.x; p.z = pos.z;
    playerMesh.position.set(p.x, 0, p.z);
    playerMesh.rotation.y = p.yaw;
    const legs = playerMesh.getObjectByName('legs');
    if (legs) legs.rotation.x = p.moving ? Math.sin(G.elapsed * 11) * 0.6 : 0;
    if (sound.ctx) sound.setEngine(0, false);
  } else {
    updateDriving(G, dt, sound);
    playerMesh.position.set(p.x, 0, p.z);
  }

  updateTraffic(G, dt);
  updatePedestrians(G, dt);
  updatePoliceCars(G, dt, scene);
  updatePoliceOnFoot(G, dt, scene);
  updateBeacon(G, beacon);

  // Missions.
  const ev = updateMissions(G, dt, {
    onStep: (label) => { showToast(hud, '✓ ' + label, 3); sound.ensure(); sound.pickup(); },
    onMissionDone: (m, allDone) => {
      showToast(hud, `💰 ${m.title} complete! +$${m.reward}`, 4);
      sound.ensure(); sound.missionDone();
      if (allDone) {
        G.money += 500;
        showToast(hud, '🏆 ALL JOBS DONE — Legend of Solmar Bay! +$500 bonus', 5);
      } else {
        const next = currentMission(G);
        if (next) setTimeout(() => showToast(hud, next.intro, 5), 4200);
      }
    },
  });

  // Wanted decay: heat fades when no police can see the player.
  let nearestCop = 999;
  for (const c of G.cars) if (c.police) nearestCop = Math.min(nearestCop, dist2d(c.x, c.z, p.x, p.z));
  for (const c of G.police) nearestCop = Math.min(nearestCop, dist2d(c.x, c.z, p.x, p.z));
  const decay = nearestCop > 45 ? 4 : nearestCop > 25 ? 1.5 : 0.4;
  if (G.wantedHeat > 0) {
    const before = G.wanted;
    G.wantedHeat = Math.max(0, G.wantedHeat - decay * dt);
    const stars = G.wantedHeat <= 0 ? 0 : G.wantedHeat < 20 ? 1 : G.wantedHeat < 40 ? 2 : G.wantedHeat < 60 ? 3 : G.wantedHeat < 82 ? 4 : 5;
    if (stars < before) {
      G.wanted = stars;
      if (stars === 0) showToast(hud, '😌 You lost them. The heat is off.', 3);
    }
  }
  G.shootCooldown = Math.max(0, G.shootCooldown - dt);
  // Slow health regen out of combat.
  if (G.wanted === 0 && G.health > 0 && G.health < 100) G.health = Math.min(100, G.health + 2 * dt);
  sound.setSiren(G.wanted, dt);

  if (G.health <= 0 && G.mode === 'playing' && !settling) {
    G.mode = 'dead';
    if (document.pointerLockElement) document.exitPointerLock();
    renderScreen(G, screenEl, 'dead', { onPlay: () => showMenu() });
  }
}

// --- Camera ----------------------------------------------------------------------
function updateCamera(dt) {
  const p = G.player;
  const dist = p.onFoot ? 8 : 11;
  const height = p.onFoot ? 3.2 : 4.2;
  // While driving the camera eases behind the car.
  if (!p.onFoot && p.car) {
    let dy = (p.car.yaw - G.cameraYaw) % (Math.PI * 2);
    if (dy > Math.PI) dy -= Math.PI * 2;
    if (dy < -Math.PI) dy += Math.PI * 2;
    G.cameraYaw += dy * Math.min(1, dt * 2.2);
  }
  const fx = Math.sin(G.cameraYaw), fz = Math.cos(G.cameraYaw);
  const cx = p.x - fx * dist * Math.cos(G.cameraPitch);
  const cz = p.z - fz * dist * Math.cos(G.cameraPitch);
  const cy = height + Math.sin(G.cameraPitch) * dist * 0.6;
  camera.position.set(cx, cy, cz);
  camera.lookAt(p.x, 1.6, p.z);
}

// --- Main loop ----------------------------------------------------------------------
let last = performance.now();
function frame(now) {
  requestAnimationFrame(frame);
  const dt = clamp((now - last) / 1000, 0, 0.05);
  last = now;
  if (G.mode === 'playing') updateWorld(dt, false);
  if (G.mode === 'playing' || G.mode === 'menu') {
    updateCamera(dt);
    if (G.mode === 'playing') updateHud(G, hud, dt);
  }
  renderer.render(scene, camera);
}

// --- Boot ----------------------------------------------------------------------------
if (shotName) {
  // Screenshot mode: stage the scene deterministically, settle the world,
  // hide the menu and play — the shot script waits, then screenshots.
  const preset = applyShot(G, shotName, {});
  applyTimeOfDay(preset);
  settleWorld(G, 150, (dt) => updateWorld(dt, true));
  renderScreen(G, screenEl, 'hidden', {});
  hud.root.classList.add('on');
  updateHud(G, hud, 0);
  window.__solmarReady = true;
} else {
  applyTimeOfDay('day');
  showMenu();
}
requestAnimationFrame(frame);
