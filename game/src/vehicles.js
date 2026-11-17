// Vehicles for SOLMAR BAY: car meshes, parked and traffic cars, arcade
// driving, car theft (walk up, press E), police pursuit cars and the
// wanted-level response. Cars are built from boxes and cylinders only.
import * as THREE from 'three';
import { CITY, roadCentres, clamp, dist2d, range } from './state.js';
import { resolveBuildingCollision } from './city.js';

export const CAR_COLORS = [0xc0392b, 0x2e86c1, 0xf1c40f, 0x27ae60, 0x8e44ad, 0xecf0f1, 0x1a1a1a, 0xe67e22, 0x16a085, 0xd35400];
export const CAR_NAMES = ['Comet GT', 'Sunrise Coupe', 'Bay Runner', 'Pelican Sedan', 'Marina Van', 'Coral Hatchback', 'Dune Buggy', 'Harbor Taxi'];

export function makeCarMesh(color, kind) {
  const g = new THREE.Group();
  const bodyColor = kind === 'police' ? 0x1a1a1a : color;
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(2.0, 0.65, 4.4),
    new THREE.MeshLambertMaterial({ color: bodyColor }),
  );
  body.position.y = 0.55;
  g.add(body);
  const cabin = new THREE.Mesh(
    new THREE.BoxGeometry(1.7, 0.6, 2.2),
    new THREE.MeshLambertMaterial({ color: kind === 'police' ? 0xf0f0f0 : 0x223344 }),
  );
  cabin.position.set(0, 1.15, -0.2);
  g.add(cabin);
  if (kind === 'police') {
    const lightBar = new THREE.Mesh(
      new THREE.BoxGeometry(1.2, 0.22, 0.5),
      new THREE.MeshLambertMaterial({ color: 0xff2222, emissive: 0x661111 }),
    );
    lightBar.position.set(0, 1.55, -0.2);
    lightBar.name = 'lightbar';
    g.add(lightBar);
    const stripe = new THREE.Mesh(
      new THREE.BoxGeometry(2.02, 0.18, 4.42),
      new THREE.MeshLambertMaterial({ color: 0xf0f0f0 }),
    );
    stripe.position.y = 0.62;
    g.add(stripe);
  }
  if (kind === 'taxi') {
    const sign = new THREE.Mesh(
      new THREE.BoxGeometry(0.7, 0.25, 0.4),
      new THREE.MeshLambertMaterial({ color: 0xf1c40f, emissive: 0x332200 }),
    );
    sign.position.set(0, 1.6, -0.2);
    g.add(sign);
  }
  const wheelGeo = new THREE.CylinderGeometry(0.36, 0.36, 0.3, 10);
  const wheelMat = new THREE.MeshLambertMaterial({ color: 0x111111 });
  const wheels = [];
  for (const [wx, wz] of [[-0.95, 1.45], [0.95, 1.45], [-0.95, -1.45], [0.95, -1.45]]) {
    const w = new THREE.Mesh(wheelGeo, wheelMat);
    w.rotation.z = Math.PI / 2;
    w.position.set(wx, 0.36, wz);
    g.add(w);
    wheels.push(w);
  }
  g.userData.wheels = wheels;
  // Headlights: two small emissive boxes at the front.
  const lightMat = new THREE.MeshLambertMaterial({ color: 0xfff6c0, emissive: 0x554400 });
  for (const lx of [-0.65, 0.65]) {
    const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.18, 0.08), lightMat);
    lamp.position.set(lx, 0.6, 2.22);
    g.add(lamp);
  }
  return g;
}

// Spawn the fleet: parked cars along the roads, moving traffic on the road
// grid, and a few taxis. Traffic cars pick a road line and a direction and
// loop around the city; parked cars wait to be stolen.
export function spawnVehicles(scene, G) {
  const rng = G.rng;
  const roads = roadCentres();
  const half = CITY.half;
  G.cars = [];
  // Traffic: 14 cars driving the grid.
  for (let i = 0; i < 14; i++) {
    const horizontal = rng() < 0.5;
    const road = roads[Math.floor(rng() * roads.length)];
    const color = CAR_COLORS[Math.floor(rng() * CAR_COLORS.length)];
    const kind = rng() < 0.15 ? 'taxi' : 'traffic';
    const mesh = makeCarMesh(color, kind);
    scene.add(mesh);
    const car = {
      mesh, kind, color, name: CAR_NAMES[Math.floor(rng() * CAR_NAMES.length)],
      x: range(rng, -half, half), z: range(rng, -half, half),
      yaw: horizontal ? (rng() < 0.5 ? 0 : Math.PI) : (rng() < 0.5 ? Math.PI / 2 : -Math.PI / 2),
      speed: 0, cruise: 7 + rng() * 5, horizontal, road,
      lane: rng() < 0.5 ? -3.2 : 3.2, parked: false, police: false, stolen: false,
    };
    if (horizontal) car.z = road + car.lane; else car.x = road + car.lane;
    G.cars.push(car);
  }
  // Parked: 12 cars at the kerb, free for the taking.
  for (let i = 0; i < 12; i++) {
    const horizontal = rng() < 0.5;
    const road = roads[Math.floor(rng() * roads.length)];
    const color = CAR_COLORS[Math.floor(rng() * CAR_COLORS.length)];
    const mesh = makeCarMesh(color, 'parked');
    scene.add(mesh);
    const car = {
      mesh, kind: 'parked', color, name: CAR_NAMES[Math.floor(rng() * CAR_NAMES.length)],
      x: range(rng, -half + 10, half - 10), z: range(rng, -half + 10, half - 10),
      yaw: horizontal ? (rng() < 0.5 ? 0 : Math.PI) : (rng() < 0.5 ? Math.PI / 2 : -Math.PI / 2),
      speed: 0, cruise: 0, horizontal, road, lane: 0, parked: true, police: false, stolen: false,
    };
    if (horizontal) { car.z = road + (rng() < 0.5 ? -6.4 : 6.4); } else { car.x = road + (rng() < 0.5 ? -6.4 : 6.4); }
    G.cars.push(car);
    G.carSpawns.push({ x: car.x, z: car.z });
  }
}

export function nearestCar(G, x, z, maxDist) {
  let best = null, bestD = maxDist;
  for (const c of G.cars) {
    if (c.police) continue;
    const d = dist2d(x, z, c.x, c.z);
    if (d < bestD) { bestD = d; best = c; }
  }
  return best;
}

// Arcade driving: W/S accelerate and brake, A/D steer (steering scales
// with speed), Space handbrake. Buildings stop the car; other cars nudge.
export function updateDriving(G, dt, sound) {
  const p = G.player;
  const car = p.car;
  if (!car) return;
  const k = G.keys;
  const accel = k.KeyW || k.ArrowUp ? 14 : 0;
  const brake = k.KeyS || k.ArrowDown ? 18 : 0;
  car.speed += accel * dt;
  car.speed -= brake * dt;
  car.speed -= car.speed * 0.55 * dt; // drag + rolling resistance
  if (k.Space) car.speed -= car.speed * 2.2 * dt;
  car.speed = clamp(car.speed, -9, 34);
  // Screenshot staging: the chase cover caps the getaway car so the
  // pursuing cruisers can catch up and appear in frame.
  if (G.shot === 'chase') car.speed = Math.min(car.speed, 15);
  const steer = (k.KeyA || k.ArrowLeft ? 1 : 0) - (k.KeyD || k.ArrowRight ? 1 : 0);
  const steerRate = 1.9 * clamp(Math.abs(car.speed) / 8, 0.25, 1) * Math.sign(car.speed || 1);
  car.yaw += steer * steerRate * dt;
  const nx = car.x + Math.sin(car.yaw) * car.speed * dt;
  const nz = car.z + Math.cos(car.yaw) * car.speed * dt;
  const before = { x: car.x, z: car.z };
  car.x = nx; car.z = nz;
  const pos = { x: car.x, z: car.z };
  resolveBuildingCollision(G, pos, 2.2);
  if (pos.x !== car.x || pos.z !== car.z) {
    // Hit a building: scrape off speed and play a thud.
    if (Math.abs(car.speed) > 6 && sound) sound.crash();
    car.speed *= 0.45;
    car.x = pos.x; car.z = pos.z;
  }
  // Soft city bounds and the beach edge.
  car.x = clamp(car.x, -CITY.half - 4, CITY.half + 20);
  car.z = clamp(car.z, -CITY.half - 4, CITY.half + 4);
  // Bumping other cars slows both down.
  for (const o of G.cars) {
    if (o === car || o.parked) continue;
    if (dist2d(car.x, car.z, o.x, o.z) < 4.2) car.speed *= 0.92;
  }
  car.mesh.position.set(car.x, 0, car.z);
  car.mesh.rotation.y = car.yaw;
  for (const w of car.mesh.userData.wheels) w.rotation.x += car.speed * dt * 2.4;
  p.x = car.x; p.z = car.z; p.yaw = car.yaw; p.speed = car.speed;
  if (sound) sound.setEngine(Math.abs(car.speed) * 3.6, true);
}

// Traffic AI: cruise along the current road; at the city edge turn onto
// the next road. Parked cars never move. Police cars chase the player.
export function updateTraffic(G, dt) {
  const half = CITY.half;
  for (const car of G.cars) {
    if (car.parked || car.police) continue;
    if (car === G.player.car) continue;
    car.speed = car.cruise;
    let nx = car.x + Math.sin(car.yaw) * car.speed * dt;
    let nz = car.z + Math.cos(car.yaw) * car.speed * dt;
    // Reached the edge: turn 90 degrees onto the next parallel road.
    if (nx > half || nx < -half || nz > half || nz < -half) {
      const roads = roadCentres();
      const next = roads[Math.floor(G.rng() * roads.length)];
      car.yaw += (G.rng() < 0.5 ? 1 : -1) * Math.PI / 2;
      if (Math.abs(Math.sin(car.yaw)) > 0.5) { car.z = next + car.lane; car.x = clamp(car.x, -half + 4, half - 4); }
      else { car.x = next + car.lane; car.z = clamp(car.z, -half + 4, half - 4); }
      nx = car.x; nz = car.z;
    }
    car.x = nx; car.z = nz;
    car.mesh.position.set(car.x, 0, car.z);
    car.mesh.rotation.y = car.yaw;
    for (const w of car.mesh.userData.wheels) w.rotation.x += car.speed * dt * 2.4;
  }
}

// Police pursuit cars: spawn at the city edge, chase the player's position
// with a little wobble, ram gently, and despawn when the heat is gone.
export function updatePoliceCars(G, dt, scene) {
  const p = G.player;
  const want = G.wanted > 0 ? Math.min(3, G.wanted) : 0;
  let active = G.cars.filter((c) => c.police);
  while (active.length < want) {
    const mesh = makeCarMesh(0x111111, 'police');
    scene.add(mesh);
    const angle = G.rng() * Math.PI * 2;
    const car = {
      mesh, kind: 'police', color: 0x111111, name: 'Patrol Cruiser',
      x: p.x + Math.cos(angle) * 55, z: p.z + Math.sin(angle) * 55,
      yaw: 0, speed: 0, cruise: 16, horizontal: false, road: 0, lane: 0,
      parked: false, police: true, stolen: false,
    };
    car.x = clamp(car.x, -CITY.half, CITY.half);
    car.z = clamp(car.z, -CITY.half, CITY.half);
    G.cars.push(car);
    active.push(car);
  }
  for (const car of active) {
    if (G.wanted === 0) {
      // Heat gone: the cruiser peels off and despawns at a distance.
      const d = dist2d(car.x, car.z, p.x, p.z);
      if (d > 70) {
        scene.remove(car.mesh);
        G.cars.splice(G.cars.indexOf(car), 1);
        continue;
      }
    }
    const dx = p.x - car.x, dz = p.z - car.z;
    const targetYaw = Math.atan2(dx, dz);
    let dy = targetYaw - car.yaw;
    while (dy > Math.PI) dy -= Math.PI * 2;
    while (dy < -Math.PI) dy += Math.PI * 2;
    car.yaw += clamp(dy, -2.4 * dt, 2.4 * dt);
    const targetSpeed = G.wanted === 0 ? 18 : 15 + G.wanted * 2.5;
    car.speed += (targetSpeed - car.speed) * Math.min(1, dt * 1.2);
    car.x += Math.sin(car.yaw) * car.speed * dt;
    car.z += Math.cos(car.yaw) * car.speed * dt;
    const pos = { x: car.x, z: car.z };
    resolveBuildingCollision(G, pos, 2.2);
    car.x = pos.x; car.z = pos.z;
    car.mesh.position.set(car.x, 0, car.z);
    car.mesh.rotation.y = car.yaw;
    const bar = car.mesh.getObjectByName('lightbar');
    if (bar) bar.material.color.setHex(Math.sin(G.elapsed * 6) > 0 ? 0xff2222 : 0x2266ff);
    // Ramming the player on foot hurts; ramming the player's car slows it.
    if (dist2d(car.x, car.z, p.x, p.z) < 3.4) {
      if (p.onFoot) G.health = Math.max(0, G.health - 22 * dt);
      else if (p.car) p.car.speed *= 0.985;
    }
  }
}
