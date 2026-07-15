import type { GameSettings, Subdivision } from "../types";

type AudioContextConstructor = typeof AudioContext;

function getAudioContextConstructor(): AudioContextConstructor | null {
  if (typeof window === "undefined") return null;
  const audioWindow = window as typeof window & {
    webkitAudioContext?: AudioContextConstructor;
  };
  return window.AudioContext ?? audioWindow.webkitAudioContext ?? null;
}

export class AudioEngine {
  private context: AudioContext | null = null;
  private fallbackStartedAt = Date.now() / 1000;
  private fallbackPausedAt: number | null = null;

  async unlock(): Promise<boolean> {
    const AudioContextClass = getAudioContextConstructor();
    if (!AudioContextClass) return false;
    this.context ??= new AudioContextClass({ latencyHint: "interactive" });
    if (this.context.state === "suspended") await this.context.resume();
    return this.context.state === "running";
  }

  get currentTime(): number {
    const fallbackNow = this.fallbackPausedAt ?? Date.now() / 1000;
    return this.context?.currentTime ?? fallbackNow - this.fallbackStartedAt;
  }

  get isReady(): boolean {
    return this.context?.state === "running";
  }

  async suspend(): Promise<void> {
    if (this.context?.state === "running") {
      await this.context.suspend();
    } else if (!this.context && this.fallbackPausedAt === null) {
      this.fallbackPausedAt = Date.now() / 1000;
    }
  }

  async resume(): Promise<void> {
    if (this.context?.state === "suspended") {
      await this.context.resume();
    } else if (!this.context && this.fallbackPausedAt !== null) {
      this.fallbackStartedAt += Date.now() / 1000 - this.fallbackPausedAt;
      this.fallbackPausedAt = null;
    }
  }

  async reset(): Promise<boolean> {
    if (this.context && this.context.state !== "closed") {
      await this.context.close();
    }
    this.context = null;
    this.fallbackStartedAt = Date.now() / 1000;
    this.fallbackPausedAt = null;
    return this.unlock();
  }

  private tone(
    when: number,
    frequency: number,
    duration: number,
    volume: number,
    type: OscillatorType = "sine",
  ): void {
    if (!this.context || this.context.state === "closed") return;
    const oscillator = this.context.createOscillator();
    const gain = this.context.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, when);
    gain.gain.setValueAtTime(0.0001, when);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0001, volume), when + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, when + duration);
    oscillator.connect(gain);
    gain.connect(this.context.destination);
    oscillator.start(when);
    oscillator.stop(when + duration + 0.02);
  }

  scheduleCountIn(
    start: number,
    secondsPerBeat: number,
    settings: GameSettings,
  ): void {
    if (!settings.sound || !settings.metronome) return;
    for (let beat = 0; beat < 4; beat += 1) {
      this.tone(
        start + beat * secondsPerBeat,
        beat === 0 ? 740 : 560,
        0.07,
        0.13,
        "triangle",
      );
    }
  }

  schedulePattern(
    pattern: readonly Subdivision[],
    start: number,
    secondsPerBeat: number,
    settings: GameSettings,
  ): void {
    if (!settings.sound) return;
    pattern.forEach((subdivision, beatIndex) => {
      for (let index = 0; index < subdivision; index += 1) {
        const when =
          start + beatIndex * secondsPerBeat + (secondsPerBeat * index) / subdivision;
        this.tone(
          when,
          index === 0 ? 660 : 520,
          0.075,
          index === 0 ? 0.15 : 0.105,
          "triangle",
        );
      }
    });
  }

  scheduleSingleSubdivision(
    subdivision: Subdivision,
    bpm: number,
    settings: GameSettings,
  ): number {
    if (!this.context) return 0;
    const start = this.context.currentTime + 0.12;
    const secondsPerBeat = 60 / bpm;
    this.schedulePattern([subdivision], start, secondsPerBeat, settings);
    return start;
  }

  inputFeedback(judgement: "Perfect" | "Good" | "Miss", enabled: boolean): void {
    if (!enabled || !this.context) return;
    const now = this.context.currentTime;
    if (judgement === "Perfect") {
      this.tone(now, 820, 0.055, 0.08, "sine");
    } else if (judgement === "Good") {
      this.tone(now, 610, 0.045, 0.055, "triangle");
    } else {
      this.tone(now, 180, 0.07, 0.045, "square");
    }
  }

  clearJingle(enabled: boolean): void {
    if (!enabled || !this.context) return;
    const start = this.context.currentTime + 0.05;
    [523.25, 659.25, 783.99].forEach((frequency, index) => {
      this.tone(start + index * 0.12, frequency, 0.16, 0.08, "triangle");
    });
  }
}
