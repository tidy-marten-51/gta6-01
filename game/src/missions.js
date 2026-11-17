// Missions and story for SOLMAR BAY. Fixer Marisol Vega hires getaway
// driver Rook Calloway for three jobs across the city. Each mission is a
// chain of steps with a map marker, a floating beacon, intro and complete
// text, and a cash reward. Finishing all three opens free-roam "legend"
// status with a bonus.
import * as THREE from 'three';
import { dist2d } from './state.js';

export const MISSIONS = [
  {
    id: 'pickup',
    title: 'The Pickup',
    giver: 'Marisol Vega',
    intro: 'Marisol Vega needs a driver she can trust. Steal any car, then reach the blue marker at the Marina to meet her courier.',
    steps: [
      { label: 'Steal a car (walk up and press E)', needCar: true, x: 0, z: 0 },
      { label: 'Drive to the Marina meet — follow the gold beacon', x: 145, z: -87, radius: 9 },
      { label: 'Return to Marisol at Plaza Verde', x: 0, z: 0, radius: 9 },
    ],
    reward: 400,
  },
  {
    id: 'delivery',
    title: 'The Bayfront Run',
    giver: 'Marisol Vega',
    intro: 'A package for the Coral Club, and the clock is ticking. Deliver it to the bayfront before the timer runs out — the cops are already sniffing around.',
    steps: [
      { label: 'Pick up the package at the Docks', x: -87, z: 87, radius: 9, timer: 150 },
      { label: 'Deliver to the Coral Club on the bayfront', x: 145, z: 29, radius: 9, timer: 150 },
    ],
    reward: 650,
  },
  {
    id: 'escape',
    title: 'The Long Way Home',
    giver: 'Marisol Vega',
    intro: 'The job went loud. Lose the heat, then bring the car home to the Hideout garage in the north-west. No cops on your tail when you arrive.',
    steps: [
      { label: 'Lose the police — stay out of sight until your stars fade', needCool: true },
      { label: 'Reach the Hideout garage, north-west corner', x: -145, z: -145, radius: 10 },
    ],
    reward: 900,
  },
];

export function currentMission(G) {
  return G.missionIndex < MISSIONS.length ? MISSIONS[G.missionIndex] : null;
}

export function currentStep(G) {
  const m = currentMission(G);
  return m ? m.steps[G.missionStep] : null;
}

// A tall golden beacon cylinder plus a pulsing ring marks the active
// objective; the minimap and the HUD arrow point at the same spot.
export function buildBeacon(scene) {
  const group = new THREE.Group();
  const beam = new THREE.Mesh(
    new THREE.CylinderGeometry(1.6, 1.6, 42, 12, 1, true),
    new THREE.MeshBasicMaterial({ color: 0xffd23e, transparent: true, opacity: 0.28, side: THREE.DoubleSide, depthWrite: false }),
  );
  beam.position.y = 21;
  group.add(beam);
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(2.4, 3.4, 24),
    new THREE.MeshBasicMaterial({ color: 0xffd23e, transparent: true, opacity: 0.85, side: THREE.DoubleSide }),
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.25;
  ring.name = 'ring';
  group.add(ring);
  group.visible = false;
  scene.add(group);
  return group;
}

export function updateBeacon(G, beacon) {
  const step = currentStep(G);
  if (!step || step.needCar || step.needCool || step.x === undefined) {
    beacon.visible = false;
    return;
  }
  beacon.visible = true;
  beacon.position.set(step.x, 0, step.z);
  const ring = beacon.getObjectByName('ring');
  if (ring) {
    const s = 1 + Math.sin(G.elapsed * 3) * 0.18;
    ring.scale.set(s, s, 1);
  }
}

export function missionObjectiveText(G) {
  const m = currentMission(G);
  if (!m) return 'All jobs done — Solmar Bay is yours, legend. Free roam!';
  const step = currentStep(G);
  return step.label;
}

// Advance the mission chain. Returns an event string for the HUD/sound:
// 'step', 'done', 'failed' or null.
export function updateMissions(G, dt, callbacks) {
  const m = currentMission(G);
  if (!m) return null;
  const step = currentStep(G);
  if (!step) return null;
  if (step.timer !== undefined && G.missionTimer > 0) {
    G.missionTimer -= dt;
    if (G.missionTimer <= 0) {
      G.missionStep = 0;
      G.missionTimer = 0;
      G.message = 'Too slow — Marisol gave the job to someone else. Try again.';
      G.messageUntil = G.elapsed + 3;
      return 'failed';
    }
  }
  const p = G.player;
  if (step.needCar) {
    if (!p.onFoot) {
      G.missionStep += 1;
      callbacks.onStep('Got wheels. Marisol is pleased — now drive to the Marina.');
      return 'step';
    }
    return null;
  }
  if (step.needCool) {
    if (G.wanted === 0 && G.wantedHeat <= 0) {
      G.missionStep += 1;
      callbacks.onStep('Clean. Now slip home to the Hideout.');
      return 'step';
    }
    return null;
  }
  if (step.x !== undefined) {
    if (dist2d(p.x, p.z, step.x, step.z) < (step.radius || 9)) {
      if (step.timer !== undefined) G.missionTimer = step.timer;
      G.missionStep += 1;
      if (G.missionStep >= m.steps.length) {
        G.money += m.reward;
        G.rep += 25;
        G.stats.missionsDone += 1;
        G.missionIndex += 1;
        G.missionStep = 0;
        G.missionTimer = 0;
        const done = G.missionIndex >= MISSIONS.length;
        callbacks.onMissionDone(m, done);
        return 'done';
      }
      callbacks.onStep(m.steps[G.missionStep].label);
      return 'step';
    }
  }
  return null;
}

export function startMission(G, index) {
  G.missionIndex = index;
  G.missionStep = 0;
  G.missionTimer = 0;
  const m = MISSIONS[index];
  if (!m) return '';
  return m.intro;
}

export function missionTimerText(G) {
  if (G.missionTimer > 0) {
    const s = Math.ceil(G.missionTimer);
    return ` ⏱ ${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  }
  return '';
}
