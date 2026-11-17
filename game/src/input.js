// Keyboard and mouse input for SOLMAR BAY: WASD movement, mouse-orbit
// third-person camera with pointer lock, E to enter/exit cars, F to shoot
// (or mouse click), R to reload a mission step, P/Esc to pause, M to mute.
export function bindInput(G, canvas, callbacks) {
  const keys = G.keys;
  window.addEventListener('keydown', (e) => {
    if (e.repeat) return;
    keys[e.code] = true;
    if (e.code === 'KeyE') callbacks.onEnterCar();
    if (e.code === 'KeyF') callbacks.onShoot();
    if (e.code === 'KeyP' || e.code === 'Escape') callbacks.onPause();
    if (e.code === 'KeyM') callbacks.onMute();
    if (e.code === 'KeyR') callbacks.onRestartMission();
    if (e.code === 'Space') { keys.Space = true; e.preventDefault(); }
  });
  window.addEventListener('keyup', (e) => { keys[e.code] = false; });
  window.addEventListener('blur', () => { for (const k of Object.keys(keys)) keys[k] = false; });

  canvas.addEventListener('click', () => {
    if (G.mode !== 'playing') return;
    if (document.pointerLockElement !== canvas) {
      try { canvas.requestPointerLock(); } catch { /* pointer lock unavailable */ }
    }
  });
  document.addEventListener('mousemove', (e) => {
    if (document.pointerLockElement === canvas) {
      G.mouseDX += e.movementX || 0;
      G.mouseDY += e.movementY || 0;
    }
  });
  canvas.addEventListener('mousedown', (e) => {
    if (e.button === 0 && G.mode === 'playing') callbacks.onShoot();
  });
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());
}

export function consumeMouse(G) {
  const dx = G.mouseDX, dy = G.mouseDY;
  G.mouseDX = 0; G.mouseDY = 0;
  return { dx, dy };
}
