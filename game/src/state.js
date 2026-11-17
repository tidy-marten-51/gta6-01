// Shared game state and the deterministic random source for SOLMAR BAY.
// Every random choice in the city layout and in traffic comes from a seeded
// generator, so a fixed seed always builds the same city.
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }
export function range(rng, lo, hi) { return lo + rng() * (hi - lo); }
export function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }
export function lerp(a, b, t) { return a + (b - a) * t; }
export function dist2d(ax, az, bx, bz) { return Math.hypot(ax - bx, az - bz); }

// City geometry: a 5x5 grid of blocks separated by roads, with a beach and
// the bay along the east edge. All positions are in metres, origin at the
// city centre, +x east toward the water, +z south.
export const CITY = {
  blocks: 5,
  block: 42,
  road: 16,
  get size() { return this.blocks * (this.block + this.road) + this.road; },
  get half() { return this.size / 2; },
};

// Road centre lines (one per grid line, both directions).
export function roadCentres() {
  const out = [];
  const step = CITY.block + CITY.road;
  for (let i = 0; i <= CITY.blocks; i++) out.push(-CITY.half + CITY.road / 2 + i * step);
  return out;
}

export function createGameState(seed) {
  return {
    seed,
    rng: mulberry32(seed),
    mode: 'menu', // menu | playing | paused | dead
    shot: null,
    money: 250,
    health: 100,
    wanted: 0,
    wantedHeat: 0, // 0..100, drives star count and police pressure
    rep: 0, // street reputation earned from missions
    clockMin: 9 * 60 + 24, // game clock starts 09:24
    timeScale: 1,
    missionIndex: 0,
    missionStep: 0,
    missionTimer: 0,
    player: {
      x: 0, z: 60, yaw: Math.PI, speed: 0,
      onFoot: true, car: null, // car object when driving
      vx: 0, vz: 0, moving: false,
    },
    cameraYaw: Math.PI,
    cameraPitch: 0.32,
    cameraDist: 9,
    keys: {},
    mouseDX: 0, mouseDY: 0,
    shooting: false,
    shootCooldown: 0,
    cars: [], // traffic + parked + police, each {mesh, x, z, yaw, speed, kind, color, stolen}
    peds: [], // {mesh, x, z, yaw, speed, state, color}
    police: [], // on-foot officers {mesh, x, z, yaw, speed}
    buildings: [], // AABBs for collision {minX, maxX, minZ, maxZ, h}
    carSpawns: [],
    markers: [], // mission target positions {x, z, label}
    message: '',
    messageUntil: 0,
    stats: { carsStolen: 0, missionsDone: 0, pedsHit: 0, shotsFired: 0 },
    elapsed: 0,
    saveSlot: 'solmarbay-save-v1',
  };
}

export function saveGame(G) {
  try {
    const data = {
      money: G.money, health: G.health, rep: G.rep,
      missionIndex: G.missionIndex, missionStep: G.missionStep,
      stats: G.stats, clockMin: G.clockMin,
    };
    localStorage.setItem(G.saveSlot, JSON.stringify(data));
    return true;
  } catch { return false; }
}

export function loadGame(G) {
  try {
    const raw = localStorage.getItem(G.saveSlot);
    if (!raw) return false;
    const d = JSON.parse(raw);
    G.money = d.money ?? G.money; G.health = d.health ?? 100;
    G.rep = d.rep ?? 0; G.missionIndex = d.missionIndex ?? 0;
    G.missionStep = d.missionStep ?? 0; G.stats = d.stats ?? G.stats;
    G.clockMin = d.clockMin ?? G.clockMin;
    return true;
  } catch { return false; }
}

export function hasSave() {
  try { return !!localStorage.getItem('solmarbay-save-v1'); } catch { return false; }
}
