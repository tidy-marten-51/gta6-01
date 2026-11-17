// Procedural Solmar Bay: a sun-soaked coastal city built from a seed.
// Street grid, varied buildings with lit windows, palms, lamps, a beach
// and the bay to the east, a boardwalk, a central plaza and a marina.
// All meshes are plain three.js boxes/cylinders with flat colours —
// original art, no imported assets.
import * as THREE from 'three';
import { CITY, roadCentres, pick, range, clamp } from './state.js';

const PALETTES = [
  [0xe8d8b0, 0xd9c49a, 0xc9a86a], // sandstone
  [0xf2e6d8, 0xe0cdb8, 0xcfb49a], // cream
  [0xbcd6e8, 0x9fc3dd, 0x7fa8c9], // sea blue
  [0xe8b4a0, 0xdd9a80, 0xc97f63], // terracotta
  [0xc4d6b8, 0xa9c49a, 0x8fb07e], // sage
  [0xd8d8e0, 0xbfbfcc, 0xa6a6b8], // grey
];
const ROOF_COLORS = [0x5a4a3a, 0x3a4a5a, 0x6a3a3a, 0x4a5a4a];

export function buildCity(scene, G) {
  const rng = G.rng;
  const group = new THREE.Group();
  group.name = 'SolmarBayCity';
  const half = CITY.half;
  const roads = roadCentres();

  // Ground: grass-green base, then road strips, sidewalks and the beach.
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(CITY.size + 260, CITY.size + 260),
    new THREE.MeshLambertMaterial({ color: 0x7fae62 }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(40, 0, 0);
  group.add(ground);

  // The bay: a wide blue plane east of the city, with a sandy beach strip.
  const bay = new THREE.Mesh(
    new THREE.PlaneGeometry(220, CITY.size + 260),
    new THREE.MeshLambertMaterial({ color: 0x1e6f9e }),
  );
  bay.rotation.x = -Math.PI / 2;
  bay.position.set(half + 110, 0.05, 0);
  group.add(bay);
  const beach = new THREE.Mesh(
    new THREE.PlaneGeometry(26, CITY.size + 40),
    new THREE.MeshLambertMaterial({ color: 0xe8d49a }),
  );
  beach.rotation.x = -Math.PI / 2;
  beach.position.set(half + 13, 0.08, 0);
  group.add(beach);

  // Roads: dark asphalt strips along every grid line, with pale centre dashes.
  const roadMat = new THREE.MeshLambertMaterial({ color: 0x2e3138 });
  const dashMat = new THREE.MeshLambertMaterial({ color: 0xd8c96a });
  for (const c of roads) {
    const hRoad = new THREE.Mesh(new THREE.PlaneGeometry(CITY.size, CITY.road), roadMat);
    hRoad.rotation.x = -Math.PI / 2; hRoad.position.set(0, 0.1, c);
    group.add(hRoad);
    const vRoad = new THREE.Mesh(new THREE.PlaneGeometry(CITY.road, CITY.size), roadMat);
    vRoad.rotation.x = -Math.PI / 2; vRoad.position.set(c, 0.1, 0);
    group.add(vRoad);
    for (let d = -half + 10; d < half; d += 12) {
      const dash = new THREE.Mesh(new THREE.PlaneGeometry(4, 0.5), dashMat);
      dash.rotation.x = -Math.PI / 2; dash.position.set(d, 0.12, c);
      group.add(dash);
    }
  }

  // Buildings: one or two per block, heights rising toward the centre and
  // the bayfront; each gets a roof slab and a window grid on its faces.
  const buildings = [];
  const blockStep = CITY.block + CITY.road;
  for (let bx = 0; bx < CITY.blocks; bx++) {
    for (let bz = 0; bz < CITY.blocks; bz++) {
      const cx = -half + CITY.road + CITY.block / 2 + bx * blockStep;
      const cz = -half + CITY.road + CITY.block / 2 + bz * blockStep;
      // The middle block is Plaza Verde, an open park with a fountain.
      if (bx === 2 && bz === 2) {
        const plaza = new THREE.Mesh(
          new THREE.PlaneGeometry(CITY.block, CITY.block),
          new THREE.MeshLambertMaterial({ color: 0x9ccb8a }),
        );
        plaza.rotation.x = -Math.PI / 2; plaza.position.set(cx, 0.12, cz);
        group.add(plaza);
        const fountain = new THREE.Mesh(
          new THREE.CylinderGeometry(5, 6, 1.2, 20),
          new THREE.MeshLambertMaterial({ color: 0x7fb3d8 }),
        );
        fountain.position.set(cx, 0.6, cz);
        group.add(fountain);
        continue;
      }
      const count = rng() < 0.55 ? 2 : 1;
      for (let k = 0; k < count; k++) {
        const w = count === 1 ? CITY.block * 0.72 : CITY.block * 0.42;
        const d = count === 1 ? CITY.block * 0.72 : CITY.block * 0.42;
        const ox = count === 1 ? 0 : (k === 0 ? -CITY.block * 0.24 : CITY.block * 0.24);
        const oz = count === 1 ? 0 : (k === 0 ? -CITY.block * 0.24 : CITY.block * 0.24);
        const centreBias = 1 - (Math.abs(cx) + Math.abs(cz)) / (2 * half);
        const h = clamp(range(rng, 8, 14) + centreBias * range(rng, 6, 30) + (cx > half - 60 ? 8 : 0), 7, 46);
        const pal = pick(rng, PALETTES);
        const mat = new THREE.MeshLambertMaterial({ color: pal[Math.floor(rng() * pal.length)] });
        const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
        b.position.set(cx + ox, h / 2, cz + oz);
        group.add(b);
        const roof = new THREE.Mesh(
          new THREE.BoxGeometry(w * 0.86, 0.8, d * 0.86),
          new THREE.MeshLambertMaterial({ color: pick(rng, ROOF_COLORS) }),
        );
        roof.position.set(cx + ox, h + 0.4, cz + oz);
        group.add(roof);
        // Window grid: small emissive planes on the two street-facing sides.
        const floors = Math.max(2, Math.floor(h / 4));
        const winGeo = new THREE.PlaneGeometry(1.6, 2.0);
        const cols = Math.max(2, Math.floor(w / 5));
        for (let f = 0; f < floors; f++) {
          for (let c = 0; c < cols; c++) {
            const wx = cx + ox - w / 2 + 3 + c * ((w - 6) / Math.max(1, cols - 1));
            const wy = 3 + f * 3.6;
            const win = new THREE.Mesh(winGeo, new THREE.MeshLambertMaterial({
              color: rng() < 0.75 ? 0xffe9a8 : 0x2a4a66,
              emissive: 0x000000,
            }));
            win.position.set(wx, wy, cz + oz + d / 2 + 0.06);
            group.add(win);
          }
        }
        buildings.push({
          minX: cx + ox - w / 2, maxX: cx + ox + w / 2,
          minZ: cz + oz - d / 2, maxZ: cz + oz + d / 2, h,
        });
      }
    }
  }

  // Palms along the beach boardwalk and the plaza; lamps at road corners.
  const trunkMat = new THREE.MeshLambertMaterial({ color: 0x7a5a38 });
  const leafMat = new THREE.MeshLambertMaterial({ color: 0x2e8b57 });
  function palm(x, z) {
    const p = new THREE.Group();
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.45, 6, 6), trunkMat);
    trunk.position.y = 3; p.add(trunk);
    for (let i = 0; i < 5; i++) {
      const leaf = new THREE.Mesh(new THREE.ConeGeometry(1.1, 3.4, 4), leafMat);
      leaf.position.y = 6.4;
      leaf.rotation.z = 1.1; leaf.rotation.y = (i / 5) * Math.PI * 2;
      leaf.position.x = Math.cos((i / 5) * Math.PI * 2) * 1.2;
      leaf.position.z = Math.sin((i / 5) * Math.PI * 2) * 1.2;
      p.add(leaf);
    }
    p.position.set(x, 0, z);
    group.add(p);
  }
  for (let z = -half + 20; z < half; z += 28) palm(half - 4, z + range(rng, -6, 6));
  for (let i = 0; i < 10; i++) palm(range(rng, -half + 20, half - 20), range(rng, -half + 20, half - 20));

  const lampMat = new THREE.MeshLambertMaterial({ color: 0x30343c });
  const lamps = [];
  for (const rx of roads) {
    for (const rz of roads) {
      if (rng() < 0.5) continue;
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 6, 6), lampMat);
      pole.position.set(rx + CITY.road / 2 + 1, 3, rz + CITY.road / 2 + 1);
      group.add(pole);
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.5, 8, 6), new THREE.MeshLambertMaterial({ color: 0xfff2b0, emissive: 0x332200 }));
      head.position.set(rx + CITY.road / 2 + 1, 6.2, rz + CITY.road / 2 + 1);
      group.add(head);
      lamps.push(head);
    }
  }

  // Boardwalk benches and crates as small props.
  const benchMat = new THREE.MeshLambertMaterial({ color: 0x8a5a2e });
  for (let z = -half + 30; z < half; z += 45) {
    const bench = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.5, 0.8), benchMat);
    bench.position.set(half - 8, 0.5, z);
    group.add(bench);
  }

  scene.add(group);
  G.buildings = buildings;
  G.cityGroup = group;
  G.lamps = lamps;
  return { buildings, roads, group };
}

// Keep the player and cars out of buildings: clamp a circle of radius r
// against every building AABB. Returns true when a collision happened.
export function collideBuildings(G, x, z, r) {
  let hit = false;
  for (const b of G.buildings) {
    const nx = clamp(x, b.minX - r, b.maxX + r);
    const nz = clamp(z, b.minZ - r, b.maxZ + r);
    const dx = x - nx, dz = z - nz;
    if (dx * dx + dz * dz < r * r) { hit = true; }
  }
  return hit;
}

export function resolveBuildingCollision(G, pos, r) {
  for (const b of G.buildings) {
    const nx = clamp(pos.x, b.minX - r, b.maxX + r);
    const nz = clamp(pos.z, b.minZ - r, b.maxZ + r);
    const dx = pos.x - nx, dz = pos.z - nz;
    const d2 = dx * dx + dz * dz;
    if (d2 < r * r && d2 > 0.0001) {
      const d = Math.sqrt(d2);
      pos.x = nx + (dx / d) * r;
      pos.z = nz + (dz / d) * r;
    } else if (d2 <= 0.0001 && pos.x > b.minX - r && pos.x < b.maxX + r && pos.z > b.minZ - r && pos.z < b.maxZ + r) {
      // Inside the box: push out along the smallest penetration axis.
      const pushes = [
        { d: pos.x - (b.minX - r), x: b.minX - r, z: pos.z },
        { d: (b.maxX + r) - pos.x, x: b.maxX + r, z: pos.z },
        { d: pos.z - (b.minZ - r), x: pos.x, z: b.minZ - r },
        { d: (b.maxZ + r) - pos.z, x: pos.x, z: b.maxZ + r },
      ];
      pushes.sort((a, b2) => a.d - b2.d);
      pos.x = pushes[0].x; pos.z = pushes[0].z;
    }
  }
}
