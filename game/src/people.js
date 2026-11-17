// Pedestrians and on-foot police for SOLMAR BAY. Pedestrians wander the
// sidewalks, cross at corners and flee from gunfire and speeding cars.
// Police officers spawn when the wanted level is high, chase the player
// on foot and make arrests (damage) on contact.
import * as THREE from 'three';
import { CITY, roadCentres, clamp, dist2d } from './state.js';
import { resolveBuildingCollision } from './city.js';

const SHIRT_COLORS = [0xe74c3c, 0x3498db, 0xf39c12, 0x2ecc71, 0x9b59b6, 0xecf0f1, 0x1abc9c, 0xe67e22];
const SKIN_COLORS = [0xf1c27d, 0xe0ac69, 0xc68642, 0x8d5524, 0xffdbac];

export function makePersonMesh(shirt, skin, police) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.CylinderGeometry(0.32, 0.38, 1.05, 8),
    new THREE.MeshLambertMaterial({ color: police ? 0x1a2a4a : shirt }),
  );
  body.position.y = 0.85;
  g.add(body);
  const head = new THREE.Mesh(
    new THREE.SphereGeometry(0.26, 10, 8),
    new THREE.MeshLambertMaterial({ color: skin }),
  );
  head.position.y = 1.62;
  g.add(head);
  const legs = new THREE.Mesh(
    new THREE.BoxGeometry(0.5, 0.55, 0.3),
    new THREE.MeshLambertMaterial({ color: police ? 0x1a2a4a : 0x2c3e50 }),
  );
  legs.position.y = 0.28;
  legs.name = 'legs';
  g.add(legs);
  if (police) {
    const cap = new THREE.Mesh(
      new THREE.CylinderGeometry(0.28, 0.28, 0.12, 10),
      new THREE.MeshLambertMaterial({ color: 0x0e1a33 }),
    );
    cap.position.y = 1.84;
    g.add(cap);
  }
  return g;
}

export function spawnPedestrians(scene, G, count) {
  const rng = G.rng;
  const half = CITY.half;
  for (let i = 0; i < count; i++) {
    const mesh = makePersonMesh(
      SHIRT_COLORS[Math.floor(rng() * SHIRT_COLORS.length)],
      SKIN_COLORS[Math.floor(rng() * SKIN_COLORS.length)],
      false,
    );
    scene.add(mesh);
    const ped = {
      mesh,
      x: (rng() * 2 - 1) * (half - 10),
      z: (rng() * 2 - 1) * (half - 10),
      yaw: rng() * Math.PI * 2,
      speed: 1 + rng() * 1.2,
      state: 'walk', // walk | flee | down
      wanderTimer: rng() * 4,
      downTimer: 0,
    };
    G.peds.push(ped);
  }
}

export function updatePedestrians(G, dt) {
  const p = G.player;
  const half = CITY.half;
  for (const ped of G.peds) {
    if (ped.state === 'down') {
      ped.downTimer -= dt;
      ped.mesh.rotation.x = -Math.PI / 2;
      if (ped.downTimer <= 0) {
        ped.state = 'walk';
        ped.mesh.rotation.x = 0;
        ped.mesh.position.y = 0;
      }
      continue;
    }
    // Flee from the player's car or from a recent gunshot.
    const playerSpeed = p.car ? Math.abs(p.car.speed) : 0;
    const nearCar = playerSpeed > 4 && dist2d(ped.x, ped.z, p.x, p.z) < 9;
    const nearShot = G.lastShotAt && (G.elapsed - G.lastShotAt) < 1.2
      && dist2d(ped.x, ped.z, p.x, p.z) < 22;
    if (nearCar || nearShot) ped.state = 'flee';
    else if (ped.state === 'flee' && dist2d(ped.x, ped.z, p.x, p.z) > 26) ped.state = 'walk';

    ped.wanderTimer -= dt;
    if (ped.state === 'walk' && ped.wanderTimer <= 0) {
      ped.yaw = G.rng() * Math.PI * 2;
      ped.wanderTimer = 2 + G.rng() * 4;
    }
    if (ped.state === 'flee') {
      // Run directly away from the player.
      ped.yaw = Math.atan2(ped.x - p.x, ped.z - p.z);
    }
    const speed = ped.state === 'flee' ? 4.6 : ped.speed;
    const nx = ped.x + Math.sin(ped.yaw) * speed * dt;
    const nz = ped.z + Math.cos(ped.yaw) * speed * dt;
    ped.x = clamp(nx, -half, half);
    ped.z = clamp(nz, -half, half);
    const pos = { x: ped.x, z: ped.z };
    resolveBuildingCollision(G, pos, 0.6);
    ped.x = pos.x; ped.z = pos.z;
    // Hit by the player's car: knocked down, wanted heat rises.
    if (p.car && Math.abs(p.car.speed) > 5 && dist2d(ped.x, ped.z, p.x, p.z) < 2.2) {
      ped.state = 'down';
      ped.downTimer = 6;
      ped.mesh.position.y = 0.4;
      G.stats.pedsHit += 1;
      addHeat(G, 22, 'You hit a pedestrian!');
    }
    ped.mesh.position.set(ped.x, 0, ped.z);
    ped.mesh.rotation.y = ped.yaw;
    const legs = ped.mesh.getObjectByName('legs');
    if (legs) legs.rotation.x = Math.sin(G.elapsed * (ped.state === 'flee' ? 14 : 7)) * 0.5;
  }
}

export function addHeat(G, amount, message) {
  G.wantedHeat = clamp(G.wantedHeat + amount, 0, 100);
  const stars = G.wantedHeat <= 0 ? 0 : G.wantedHeat < 20 ? 1 : G.wantedHeat < 40 ? 2
    : G.wantedHeat < 60 ? 3 : G.wantedHeat < 82 ? 4 : 5;
  if (stars > G.wanted && message) {
    G.message = message;
    G.messageUntil = G.elapsed + 2.5;
  }
  G.wanted = stars;
}

// On-foot officers: up to one per wanted star beyond the first, they chase
// the player, and on contact they beat the player down (health loss).
export function updatePoliceOnFoot(G, dt, scene) {
  const p = G.player;
  const want = Math.max(0, G.wanted - 1);
  let active = G.police;
  while (active.length < want) {
    const mesh = makePersonMesh(0x1a2a4a, SKIN_COLORS[Math.floor(G.rng() * SKIN_COLORS.length)], true);
    scene.add(mesh);
    const angle = G.rng() * Math.PI * 2;
    const cop = {
      mesh,
      x: clamp(p.x + Math.cos(angle) * 26, -CITY.half, CITY.half),
      z: clamp(p.z + Math.sin(angle) * 26, -CITY.half, CITY.half),
      yaw: 0, speed: 5.2 + G.wanted * 0.35,
    };
    G.police.push(cop);
    active.push(cop);
  }
  for (const cop of [...G.police]) {
    if (G.wanted === 0) {
      scene.remove(cop.mesh);
      G.police.splice(G.police.indexOf(cop), 1);
      continue;
    }
    const dx = p.x - cop.x, dz = p.z - cop.z;
    cop.yaw = Math.atan2(dx, dz);
    const d = Math.hypot(dx, dz);
    // A fast car outruns a foot officer: on foot they sprint, but they
    // cannot keep up with a moving car, so they fall behind instead of
    // standing on its roof.
    const playerSpeed = p.car ? Math.abs(p.car.speed) : 0;
    if (d > 2 && (p.onFoot || playerSpeed <= 6)) {
      cop.x += (dx / d) * cop.speed * dt;
      cop.z += (dz / d) * cop.speed * dt;
    }
    const pos = { x: cop.x, z: cop.z };
    resolveBuildingCollision(G, pos, 0.6);
    cop.x = pos.x; cop.z = pos.z;
    cop.mesh.position.set(cop.x, 0, cop.z);
    cop.mesh.rotation.y = cop.yaw;
    const legs = cop.mesh.getObjectByName('legs');
    if (legs) legs.rotation.x = Math.sin(G.elapsed * 12) * 0.6;
    if (d < 1.6) {
      // Arrest attempt: heavy damage on foot, or drag the player out.
      if (p.onFoot) G.health = Math.max(0, G.health - 30 * dt);
      else if (p.car && Math.abs(p.car.speed) < 2) {
        G.health = Math.max(0, G.health - 12 * dt);
        G.message = 'Police are dragging you out of the car — DRIVE!';
        G.messageUntil = G.elapsed + 1;
      }
    }
  }
}
