import { rms, rmsToDb } from '../../core/audio/loudness';
import type { LoudnessSample, LoudnessSource } from '../../core/audio/types';

/**
 * Microphone loudness via Web Audio. All browser voice processing is switched OFF so the level reflects the real voice
 * (echo cancellation, noise suppression and auto gain would all flatten the very onset we are measuring).
 * Audio is only ever reduced to one RMS number per animation frame; it is never recorded, stored or sent anywhere,
 * and the analyser is not connected to the speakers.
 */
export class MicSource implements LoudnessSource {
  readonly kind = 'mic' as const;
  private ctx: AudioContext | null = null;
  private stream: MediaStream | null = null;
  private raf = 0;
  private listeners = new Set<(s: LoudnessSample) => void>();
  /** Which processing flags the browser actually left on (for a warning in the UI). */
  appliedSettings: MediaTrackSettings | null = null;

  async start(): Promise<void> {
    if (this.ctx) return;
    if (!navigator.mediaDevices?.getUserMedia) throw new Error('This browser cannot access the microphone.');
    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
      video: false,
    });
    this.appliedSettings = this.stream.getAudioTracks()[0]?.getSettings() ?? null;
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    this.ctx = new Ctx();
    if (this.ctx.state === 'suspended') await this.ctx.resume();
    const src = this.ctx.createMediaStreamSource(this.stream);
    const analyser = this.ctx.createAnalyser();
    analyser.fftSize = 1024; // ~21 ms of audio at 48 kHz
    analyser.smoothingTimeConstant = 0;
    src.connect(analyser);
    const buf = new Float32Array(analyser.fftSize);
    const tick = () => {
      analyser.getFloatTimeDomainData(buf);
      const sample: LoudnessSample = { t: performance.now(), db: rmsToDb(rms(buf)) };
      this.listeners.forEach((l) => l(sample));
      this.raf = requestAnimationFrame(tick);
    };
    this.raf = requestAnimationFrame(tick);
  }

  stop(): void {
    cancelAnimationFrame(this.raf);
    this.stream?.getTracks().forEach((t) => t.stop());
    void this.ctx?.close();
    this.ctx = null;
    this.stream = null;
  }

  subscribe(cb: (s: LoudnessSample) => void): () => void {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  }

  /** True if the browser ignored our request to turn processing off. */
  get processingStillOn(): boolean {
    const s = this.appliedSettings;
    return !!s && (s.echoCancellation === true || s.noiseSuppression === true || s.autoGainControl === true);
  }
}
