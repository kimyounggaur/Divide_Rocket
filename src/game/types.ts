export type Subdivision = 1 | 2 | 3 | 4;

export type MotionMode = "full" | "reduced" | "minimal";

export type Judgement = "Perfect" | "Good" | "Miss";

export type BeatError =
  | "extra"
  | "missing"
  | "early"
  | "late"
  | "uneven"
  | null;

export type QuizOrder = "before" | "after";

export type GamePhase =
  | "idle"
  | "count-in"
  | "demo"
  | "ready"
  | "playing"
  | "paused"
  | "complete";

export type GameScreen =
  | "title"
  | "levels"
  | "briefing"
  | "play"
  | "quiz"
  | "result"
  | "guide";

export interface LevelDefinition {
  id: number;
  bpm: number;
  meter: "4/4";
  pattern: readonly [Subdivision, Subdivision, Subdivision, Subdivision];
  objective: string;
  lesson: string;
  showGrid: boolean;
  quizOrder: QuizOrder;
  quizTarget: Subdivision;
  applicationTrial: boolean;
}

export interface GameSettings {
  sound: boolean;
  haptics: boolean;
  metronome: boolean;
  motion: MotionMode;
  leftHanded: boolean;
  visualGuide: boolean;
  calibrationMs: number;
}

export interface BestScore {
  total: number;
  performance: number;
  theory: number;
  application: number;
}

export interface SaveData {
  unlockedLevel: number;
  bestScores: Record<number, BestScore>;
  settings: GameSettings;
  tutorialSeen: boolean;
}

export interface RunSchedule {
  countInStart: number;
  demoStart: number;
  readyStart: number;
  playStart: number;
  playEnd: number;
  secondsPerBeat: number;
}

export interface TimingHit {
  expectedTime: number;
  actualTime: number | null;
  offsetMs: number | null;
  judgement: Judgement;
}

export interface BeatEvaluation {
  beatIndex: number;
  subdivision: Subdivision;
  judgement: Judgement;
  error: BeatError;
  hits: TimingHit[];
  extraInputs: number;
  evennessMs: number;
  score: number;
}

export interface TrialEvaluation {
  beats: BeatEvaluation[];
  performanceScore: number;
  applicationScore: number;
  perfect: number;
  good: number;
  miss: number;
  mainError: BeatError;
}

