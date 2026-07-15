import type { GameSettings, SaveData } from "./types";

export const SAVE_KEY = "melodia.subdivision-rocket.v1";

export const DEFAULT_SETTINGS: GameSettings = {
  sound: true,
  haptics: true,
  metronome: true,
  motion: "full",
  leftHanded: false,
  visualGuide: false,
  calibrationMs: 0,
};

export const DEFAULT_SAVE: SaveData = {
  unlockedLevel: 1,
  bestScores: {},
  settings: DEFAULT_SETTINGS,
  tutorialSeen: false,
};

export function loadSave(): SaveData {
  if (typeof window === "undefined") return DEFAULT_SAVE;
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (!raw) return DEFAULT_SAVE;
    const parsed = JSON.parse(raw) as Partial<SaveData>;
    return {
      unlockedLevel: Math.max(1, Math.min(8, parsed.unlockedLevel ?? 1)),
      bestScores: parsed.bestScores ?? {},
      settings: {
        ...DEFAULT_SETTINGS,
        ...(parsed.settings ?? {}),
        calibrationMs: Math.max(
          -200,
          Math.min(200, parsed.settings?.calibrationMs ?? 0),
        ),
      },
      tutorialSeen: parsed.tutorialSeen ?? false,
    };
  } catch {
    return DEFAULT_SAVE;
  }
}

export function persistSave(save: SaveData): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(SAVE_KEY, JSON.stringify(save));
}
