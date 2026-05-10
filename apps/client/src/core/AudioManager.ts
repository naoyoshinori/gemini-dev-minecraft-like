export class AudioManager {
  ctx: AudioContext | null = null;

  constructor() {
    // Context is initialized on first user interaction
  }

  init() {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
  }

  private createOscillator(freq: number, type: OscillatorType, duration: number, volume: number) {
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + duration);

    gain.gain.setValueAtTime(volume, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + duration);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start();
    osc.stop(this.ctx.currentTime + duration);
  }

  playStep() {
    this.createOscillator(100, 'triangle', 0.1, 0.05);
  }

  playBreak() {
    this.createOscillator(150, 'sawtooth', 0.2, 0.1);
  }

  playPlace() {
    this.createOscillator(400, 'sine', 0.1, 0.1);
  }
}
