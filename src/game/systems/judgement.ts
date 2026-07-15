import type {
  BeatError,
  BeatEvaluation,
  Judgement,
  Subdivision,
  TrialEvaluation,
} from "../types";

export const PERFECT_WINDOW_MS = 70;
export const GOOD_WINDOW_MS = 130;
export const EVENNESS_WINDOW_MS = 70;

export function expectedSubdivisionTimes(
  beatStart: number,
  secondsPerBeat: number,
  subdivision: Subdivision,
): number[] {
  return Array.from(
    { length: subdivision },
    (_, index) => beatStart + (secondsPerBeat * index) / subdivision,
  );
}

export function judgeOffset(offsetMs: number): Judgement {
  const absoluteOffset = Math.abs(offsetMs);
  if (absoluteOffset <= PERFECT_WINDOW_MS) return "Perfect";
  if (absoluteOffset <= GOOD_WINDOW_MS) return "Good";
  return "Miss";
}

function getMainError(
  inputCount: number,
  expectedCount: number,
  offsets: number[],
  evennessMs: number,
): BeatError {
  if (inputCount > expectedCount) return "extra";
  if (inputCount < expectedCount) return "missing";
  if (evennessMs > EVENNESS_WINDOW_MS) return "uneven";

  const meanOffset =
    offsets.length > 0
      ? offsets.reduce((sum, value) => sum + value, 0) / offsets.length
      : 0;

  if (meanOffset < -PERFECT_WINDOW_MS) return "early";
  if (meanOffset > PERFECT_WINDOW_MS) return "late";
  return null;
}

export function evaluateBeat(
  beatIndex: number,
  beatStart: number,
  secondsPerBeat: number,
  subdivision: Subdivision,
  rawInputs: readonly number[],
): BeatEvaluation {
  const expected = expectedSubdivisionTimes(
    beatStart,
    secondsPerBeat,
    subdivision,
  );
  const inputs = [...rawInputs].sort((a, b) => a - b);
  const pairedInputs = inputs.slice(0, expected.length);
  const offsets = pairedInputs.map(
    (input, index) => (input - expected[index]) * 1000,
  );
  const intendedGapMs = (secondsPerBeat * 1000) / subdivision;
  const actualGaps = pairedInputs.slice(1).map(
    (input, index) => (input - pairedInputs[index]) * 1000,
  );
  const evennessMs =
    actualGaps.length > 0
      ? Math.max(...actualGaps.map((gap) => Math.abs(gap - intendedGapMs)))
      : 0;
  const error = getMainError(
    inputs.length,
    expected.length,
    offsets,
    evennessMs,
  );

  const hits = expected.map((expectedTime, index) => {
    const actualTime = pairedInputs[index] ?? null;
    const offsetMs = actualTime === null ? null : (actualTime - expectedTime) * 1000;
    return {
      expectedTime,
      actualTime,
      offsetMs,
      judgement: offsetMs === null ? ("Miss" as const) : judgeOffset(offsetMs),
    };
  });

  let judgement: Judgement;
  if (
    inputs.length !== expected.length ||
    hits.some((hit) => hit.judgement === "Miss")
  ) {
    judgement = "Miss";
  } else if (
    evennessMs > EVENNESS_WINDOW_MS ||
    hits.some((hit) => hit.judgement === "Good")
  ) {
    judgement = "Good";
  } else {
    judgement = "Perfect";
  }

  const hitPoints = hits.reduce((sum, hit) => {
    if (hit.judgement === "Perfect") return sum + 1;
    if (hit.judgement === "Good") return sum + 0.7;
    return sum;
  }, 0);
  const countPenalty = Math.max(0, inputs.length - expected.length) * 0.18;
  const evennessPenalty = Math.min(0.22, evennessMs / 500);
  const score = Math.round(
    Math.max(
      0,
      Math.min(1, hitPoints / expected.length - countPenalty - evennessPenalty),
    ) * 100,
  );

  return {
    beatIndex,
    subdivision,
    judgement,
    error,
    hits,
    extraInputs: Math.max(0, inputs.length - expected.length),
    evennessMs: Math.round(evennessMs),
    score,
  };
}

export function evaluateTrial(
  pattern: readonly Subdivision[],
  playStart: number,
  secondsPerBeat: number,
  inputsByBeat: readonly (readonly number[])[],
  applicationTrial: boolean,
): TrialEvaluation {
  const beats = pattern.map((subdivision, beatIndex) =>
    evaluateBeat(
      beatIndex,
      playStart + secondsPerBeat * beatIndex,
      secondsPerBeat,
      subdivision,
      inputsByBeat[beatIndex] ?? [],
    ),
  );
  const performanceScore = Math.round(
    beats.reduce((sum, beat) => sum + beat.score, 0) / beats.length,
  );

  const transitionBeats = beats.filter(
    (beat, index) => index === 0 || beat.subdivision !== beats[index - 1].subdivision,
  );
  const applicationBase = applicationTrial ? transitionBeats : beats;
  const applicationScore = Math.round(
    applicationBase.reduce((sum, beat) => sum + beat.score, 0) /
      applicationBase.length,
  );
  const counts = beats.reduce(
    (result, beat) => {
      result[beat.judgement.toLowerCase() as "perfect" | "good" | "miss"] += 1;
      return result;
    },
    { perfect: 0, good: 0, miss: 0 },
  );
  const errors = beats.map((beat) => beat.error).filter(Boolean) as Exclude<
    BeatError,
    null
  >[];
  const mainError =
    errors
      .map((error) => ({
        error,
        count: errors.filter((candidate) => candidate === error).length,
      }))
      .sort((a, b) => b.count - a.count)[0]?.error ?? null;

  return {
    beats,
    performanceScore,
    applicationScore,
    perfect: counts.perfect,
    good: counts.good,
    miss: counts.miss,
    mainError,
  };
}

