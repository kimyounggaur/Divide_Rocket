import type { LevelDefinition, Subdivision } from "../types";

export const SUBDIVISION_COPY: Record<
  Subdivision,
  { name: string; notation: string; chant: string; short: string }
> = {
  1: {
    name: "1분할 · 4분음표",
    notation: "♩",
    chant: "딴",
    short: "한 칸",
  },
  2: {
    name: "2분할 · 8분음표",
    notation: "♫",
    chant: "딴-딴",
    short: "두 칸",
  },
  3: {
    name: "3분할 · 셋잇단음표",
    notation: "3: ♪♪♪",
    chant: "타-타-타",
    short: "세 칸",
  },
  4: {
    name: "4분할 · 16분음표",
    notation: "♬♬",
    chant: "타카타카",
    short: "네 칸",
  },
};

export const LEVELS: readonly LevelDefinition[] = [
  {
    id: 1,
    bpm: 72,
    meter: "4/4",
    pattern: [1, 1, 1, 1],
    objective: "한 박의 기준을 느껴요",
    lesson: "각 박의 시작에 한 번씩 연료를 넣어요.",
    showGrid: true,
    quizOrder: "after",
    quizTarget: 1,
    applicationTrial: false,
  },
  {
    id: 2,
    bpm: 76,
    meter: "4/4",
    pattern: [2, 2, 2, 2],
    objective: "한 박을 두 칸으로 나눠요",
    lesson: "빠르게가 아니라, 두 칸을 같은 간격으로 채워요.",
    showGrid: true,
    quizOrder: "after",
    quizTarget: 2,
    applicationTrial: false,
  },
  {
    id: 3,
    bpm: 76,
    meter: "4/4",
    pattern: [3, 3, 3, 3],
    objective: "셋잇단의 세 조각을 느껴요",
    lesson: "한 박을 정확히 3등분해 타-타-타로 채워요.",
    showGrid: true,
    quizOrder: "after",
    quizTarget: 3,
    applicationTrial: false,
  },
  {
    id: 4,
    bpm: 80,
    meter: "4/4",
    pattern: [4, 4, 4, 4],
    objective: "네 칸을 고르게 점화해요",
    lesson: "네 번의 속도보다 네 칸의 균일한 간격이 중요해요.",
    showGrid: true,
    quizOrder: "after",
    quizTarget: 4,
    applicationTrial: false,
  },
  {
    id: 5,
    bpm: 82,
    meter: "4/4",
    pattern: [1, 2, 1, 2],
    objective: "한 칸과 두 칸을 바꿔 타요",
    lesson: "박의 길이는 같고, 박 안의 조각 수만 달라져요.",
    showGrid: true,
    quizOrder: "after",
    quizTarget: 2,
    applicationTrial: true,
  },
  {
    id: 6,
    bpm: 84,
    meter: "4/4",
    pattern: [2, 3, 2, 3],
    objective: "2분할과 3분할을 비교해요",
    lesson: "딴-딴과 타-타-타의 간격 차이를 들어 보세요.",
    showGrid: true,
    quizOrder: "after",
    quizTarget: 3,
    applicationTrial: true,
  },
  {
    id: 7,
    bpm: 88,
    meter: "4/4",
    pattern: [4, 2, 3, 1],
    objective: "네 가지 분할을 이어서 날아요",
    lesson: "박의 경계를 지키며 매 박의 연료칸 수를 바꿔요.",
    showGrid: false,
    quizOrder: "after",
    quizTarget: 4,
    applicationTrial: true,
  },
  {
    id: 8,
    bpm: 88,
    meter: "4/4",
    pattern: [3, 2, 4, 3],
    objective: "귀로 먼저 찾고 연주해요",
    lesson: "표기를 고른 뒤, 격자 없이 같은 리듬을 재현해요.",
    showGrid: false,
    quizOrder: "before",
    quizTarget: 3,
    applicationTrial: true,
  },
] as const;

export function getLevel(levelId: number): LevelDefinition {
  return LEVELS.find((level) => level.id === levelId) ?? LEVELS[0];
}

export function patternLabel(pattern: readonly Subdivision[]): string {
  return pattern.join(" · ");
}

