// HUD for SOLMAR BAY: wanted stars, money, health, speed, clock, mission
// objective, hints, toasts, and the circular 2D minimap that draws the
// roads, buildings, player, cars, police and the mission marker.
import { CITY, roadCentres, clamp } from './state.js';
import { currentMission, currentStep, missionObjectiveText, missionTimerText } from './missions.js';

export function makeHud() {
  return {
    root: document.getElementById('hud'),
    wanted: document.getElementById('wanted'),
    money: document.getElementById('money'),
    rep: document.getElementById('rep'),
    objective: document.getElementById('objective'),
    healthFill: document.getElementById('healthfill'),
    speed: document.getElementById('speed'),
    clock: document.getElementById('clock'),
    hint: document.getElementById('hint'),
    crosshair: document.getElementById('crosshair'),
    toast: document.getElementById('toast'),
    minimap: document.getElementById('minimap'),
    mapCtx: document.getElementById('minimap').getContext('2d'),
  };
}

export function showToast(hud, text, seconds) {
  hud.toast.textContent = text;
  hud.toast.style.opacity = '1';
  clearTimeout(hud._toastTimer);
  hud._toastTimer = setTimeout(() => { hud.toast.style.opacity = '0'; }, (seconds || 2.5) * 1000);
}

export function updateHud(G, hud, dt) {
  hud.root.classList.add('on');
  // Wanted stars: filled gold stars, the rest dim.
  let stars = '';
  for (let i = 0; i < 5; i++) stars += i < G.wanted ? '★' : '<span class="dim">★</span>';
  hud.wanted.innerHTML = stars;
  hud.money.textContent = '$' + G.money.toLocaleString('en-US');
  const m = currentMission(G);
  hud.rep.textContent = m ? `REP ${G.rep} · ${m.giver}` : `REP ${G.rep} · LEGEND OF SOLMAR BAY`;
  hud.objective.innerHTML = '<b>◆ ' + (m ? m.title : 'FREE ROAM') + '</b> — ' + missionObjectiveText(G) + missionTimerText(G);
  hud.healthFill.style.width = clamp(G.health, 0, 100) + '%';
  const kmh = G.player.car ? Math.abs(G.player.car.speed) * 3.6 : 0;
  hud.speed.innerHTML = G.player.car ? `${Math.round(kmh)} <small>km/h</small>` : '';
  const hh = Math.floor(G.clockMin / 60) % 24;
  const mm = Math.floor(G.clockMin % 60);
  hud.clock.textContent = `🕐 ${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}  ·  Solmar Bay`;
  const step = currentStep(G);
  if (G.message && G.elapsed < G.messageUntil) {
    hud.hint.textContent = G.message;
  } else if (G.player.onFoot) {
    hud.hint.textContent = 'WASD move · Mouse look · E steal car · Click shoot · P pause';
  } else {
    hud.hint.textContent = 'WASD drive · Space handbrake · E exit car · P pause';
  }
  hud.crosshair.style.display = G.player.onFoot ? 'block' : 'none';
  drawMinimap(G, hud);
}

function drawMinimap(G, hud) {
  const ctx = hud.mapCtx;
  const S = 210;
  const half = CITY.half + 30;
  const toMap = (x, z) => [S / 2 + (x / half) * (S / 2 - 6), S / 2 + (z / half) * (S / 2 - 6)];
  ctx.clearRect(0, 0, S, S);
  // Water on the east edge.
  ctx.fillStyle = '#1e6f9e';
  ctx.fillRect(S - 16, 0, 16, S);
  ctx.fillStyle = '#e8d49a';
  ctx.fillRect(S - 20, 0, 4, S);
  // Roads.
  ctx.strokeStyle = '#3a3f4a';
  ctx.lineWidth = 5;
  for (const c of roadCentres()) {
    const [x1] = toMap(c, 0); const [, z1] = toMap(0, c);
    ctx.beginPath(); ctx.moveTo(x1, 4); ctx.lineTo(x1, S - 4); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(4, z1); ctx.lineTo(S - 4, z1); ctx.stroke();
  }
  // Buildings as pale blocks.
  ctx.fillStyle = 'rgba(220,225,235,0.75)';
  for (const b of G.buildings) {
    const [x1, z1] = toMap(b.minX, b.minZ);
    const [x2, z2] = toMap(b.maxX, b.maxZ);
    ctx.fillRect(x1, z1, Math.max(1, x2 - x1), Math.max(1, z2 - z1));
  }
  // Mission marker: pulsing gold diamond.
  const step = currentStep(G);
  if (step && step.x !== undefined && !step.needCar && !step.needCool) {
    const [mx, mz] = toMap(step.x, step.z);
    const pulse = 6 + Math.sin(G.elapsed * 4) * 2;
    ctx.fillStyle = '#ffd23e';
    ctx.beginPath();
    ctx.moveTo(mx, mz - pulse); ctx.lineTo(mx + pulse, mz);
    ctx.lineTo(mx, mz + pulse); ctx.lineTo(mx - pulse, mz);
    ctx.closePath(); ctx.fill();
  }
  // Traffic cars: white dots; police: flashing blue/red.
  for (const car of G.cars) {
    const [cx, cz] = toMap(car.x, car.z);
    if (car.police) {
      ctx.fillStyle = Math.sin(G.elapsed * 6) > 0 ? '#ff2222' : '#2266ff';
      ctx.beginPath(); ctx.arc(cx, cz, 4, 0, Math.PI * 2); ctx.fill();
    } else if (car !== G.player.car) {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(cx - 1.5, cz - 1.5, 3, 3);
    }
  }
  // Player: green triangle pointing along the heading.
  const [px, pz] = toMap(G.player.x, G.player.z);
  ctx.save();
  ctx.translate(px, pz);
  ctx.rotate(Math.atan2(Math.sin(G.player.yaw), Math.cos(G.player.yaw)) * 0 + G.player.yaw);
  ctx.fillStyle = '#7dff9a';
  ctx.beginPath(); ctx.moveTo(0, -7); ctx.lineTo(5, 6); ctx.lineTo(-5, 6); ctx.closePath(); ctx.fill();
  ctx.restore();
  // North tick.
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 11px sans-serif';
  ctx.fillText('N', S / 2 - 4, 12);
}

// Start / pause / game-over screens. All text is original; the start
// screen names the city, the characters and the controls.
export function renderScreen(G, screenEl, kind, callbacks) {
  const money = G.money.toLocaleString('en-US');
  if (kind === 'menu') {
    screenEl.classList.remove('hidden');
    screenEl.innerHTML =
      '<h1>SOLMAR BAY</h1>' +
      '<h2>An original open-world crime game — steal cars, run jobs, outrun the law.</h2>' +
      '<div class="panel">You are <b>Rook Calloway</b>, a getaway driver new to Solmar Bay. ' +
      'Fixer <b>Marisol Vega</b> has three jobs for you — a pickup, a timed bayfront run, and a loud escape. ' +
      'Steal any car with <b>E</b>, follow the gold beacons, and watch the stars: the Solmar Bay Police ' +
      'Department does not forgive. Earn cash, build your rep, and stay alive.<br><br>' +
      '<b>Controls:</b> WASD move / drive · Mouse look (click to lock) · E enter &amp; exit car · ' +
      'Click / F shoot · Space handbrake · P pause · M mute · R restart mission.</div>' +
      `<button id="btn-play">▶ START ENGINE</button>` +
      (callbacks.hasSave ? '<button id="btn-continue" style="background:#7dff9a;margin-left:12px">↻ CONTINUE ($' + money + ')</button>' : '') +
      '<div class="keys">Best played with keyboard + mouse · Sound on for the engine and sirens · Progress saves with localStorage</div>';
    document.getElementById('btn-play').onclick = () => callbacks.onPlay(false);
    const cont = document.getElementById('btn-continue');
    if (cont) cont.onclick = () => callbacks.onPlay(true);
  } else if (kind === 'paused') {
    screenEl.classList.remove('hidden');
    screenEl.innerHTML =
      '<h1 style="font-size:44px">PAUSED</h1>' +
      '<div class="panel">Money <b>$' + money + '</b> · Rep <b>' + G.rep + '</b> · Missions done <b>' +
      G.stats.missionsDone + '/3</b> · Cars stolen <b>' + G.stats.carsStolen + '</b></div>' +
      '<button id="btn-resume">▶ RESUME</button>' +
      '<button id="btn-save" style="background:#7dff9a;margin-left:12px">💾 SAVE GAME</button>' +
      '<div class="keys">P / Esc to resume · M mute</div>';
    document.getElementById('btn-resume').onclick = () => callbacks.onResume();
    document.getElementById('btn-save').onclick = () => callbacks.onSave();
  } else if (kind === 'dead') {
    screenEl.classList.remove('hidden');
    screenEl.innerHTML =
      '<h1 style="font-size:44px;color:#ff6a5e">BUSTED / FLATLINED</h1>' +
      '<h2>The Solmar Bay PD caught up with Rook Calloway. Marisol Vega is not impressed.</h2>' +
      '<div class="panel">You kept <b>$' + money + '</b> and your rep of <b>' + G.rep + '</b>. ' +
      'The city is still out there — and so are its cars.</div>' +
      '<button id="btn-again">↻ TRY AGAIN</button>' +
      '<div class="keys">Tip: at 3 stars, officers chase on foot. Break line of sight to cool down.</div>';
    document.getElementById('btn-again').onclick = () => callbacks.onPlay(false);
  } else {
    screenEl.classList.add('hidden');
    screenEl.innerHTML = '';
  }
}
