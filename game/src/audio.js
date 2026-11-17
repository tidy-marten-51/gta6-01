// Synthesised sound for SOLMAR BAY: every sound is built with WebAudio
// oscillators and filtered noise — no audio files are loaded. The engine
// hum follows the player's speed, the siren wails while wanted, and short
// blips mark pickups, mission steps and gunfire.
export class SoundBank {
  constructor() {
    this.ctx = null;
    this.muted = false;
    this.engineOsc = null;
    this.engineGain = null;
    this.sirenOsc = null;
    this.sirenGain = null;
    this.sirenTimer = 0;
  }

  ensure() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AC();
      // Engine: two detuned sawtooth oscillators through a low-pass filter.
      this.engineOsc = this.ctx.createOscillator();
      this.engineOsc.type = 'sawtooth';
      this.engineOsc.frequency.value = 55;
      const engineOsc2 = this.ctx.createOscillator();
      engineOsc2.type = 'square';
      engineOsc2.frequency.value = 28;
      this.engineGain = this.ctx.createGain();
      this.engineGain.gain.value = 0.0;
      const filt = this.ctx.createBiquadFilter();
      filt.type = 'lowpass'; filt.frequency.value = 420;
      this.engineOsc.connect(filt); engineOsc2.connect(filt);
      filt.connect(this.engineGain); this.engineGain.connect(this.ctx.destination);
      this.engineOsc.start(); engineOsc2.start();
      this.engineOsc2 = engineOsc2;
      // Siren: a sine that sweeps up and down, gated by a slow LFO.
      this.sirenOsc = this.ctx.createOscillator();
      this.sirenOsc.type = 'sine';
      this.sirenOsc.frequency.value = 700;
      this.sirenGain = this.ctx.createGain();
      this.sirenGain.gain.value = 0.0;
      this.sirenOsc.connect(this.sirenGain);
      this.sirenGain.connect(this.ctx.destination);
      this.sirenOsc.start();
    } catch { this.ctx = null; }
  }

  setEngine(speedKmh, driving) {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    const f = 50 + Math.min(1, speedKmh / 140) * 130;
    this.engineOsc.frequency.setTargetAtTime(f, t, 0.08);
    if (this.engineOsc2) this.engineOsc2.frequency.setTargetAtTime(f / 2, t, 0.08);
    this.engineGain.gain.setTargetAtTime(driving ? 0.05 + Math.min(1, speedKmh / 140) * 0.05 : 0.0, t, 0.1);
  }

  setSiren(wanted, dt) {
    if (!this.ctx) return;
    this.sirenTimer += dt;
    if (wanted > 0 && !this.muted) {
      const phase = (this.sirenTimer % 1.6) / 1.6;
      const freq = phase < 0.5 ? 720 + phase * 480 : 960 - (phase - 0.5) * 480;
      this.sirenOsc.frequency.setTargetAtTime(freq, this.ctx.currentTime, 0.05);
      this.sirenGain.gain.setTargetAtTime(0.035, this.ctx.currentTime, 0.2);
    } else {
      this.sirenGain.gain.setTargetAtTime(0.0, this.ctx.currentTime, 0.2);
    }
  }

  blip(freq, dur, type, vol) {
    if (!this.ctx || this.muted) return;
    try {
      const o = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      o.type = type || 'sine'; o.frequency.value = freq || 660;
      g.gain.setValueAtTime(vol || 0.12, this.ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + (dur || 0.12));
      o.connect(g); g.connect(this.ctx.destination);
      o.start(); o.stop(this.ctx.currentTime + (dur || 0.12));
    } catch { /* audio unavailable */ }
  }

  pickup() { this.blip(880, 0.1, 'sine', 0.14); setTimeout(() => this.blip(1320, 0.14, 'sine', 0.14), 90); }
  missionDone() { [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => this.blip(f, 0.18, 'triangle', 0.15), i * 110)); }
  gunshot() {
    if (!this.ctx || this.muted) return;
    try {
      const len = this.ctx.sampleRate * 0.09;
      const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const ch = buf.getChannelData(0);
      for (let i = 0; i < len; i++) ch[i] = (Math.random() * 2 - 1) * (1 - i / len);
      const src = this.ctx.createBufferSource(); src.buffer = buf;
      const g = this.ctx.createGain(); g.gain.value = 0.25;
      src.connect(g); g.connect(this.ctx.destination); src.start();
    } catch { /* audio unavailable */ }
  }
  crash() { this.blip(90, 0.25, 'sawtooth', 0.2); }
  toggleMute() { this.muted = !this.muted; return this.muted; }
}
