"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { AudioEngine } from "./audio/AudioEngine";
import { BeatFuelGrid } from "./components/BeatFuelGrid";
import { RocketCanvas } from "./components/RocketCanvas";
import { TimingGraph } from "./components/TimingGraph";
import { LEVELS, SUBDIVISION_COPY, getLevel, patternLabel } from "./data/levels";
import { useFocusTrap } from "./hooks/useFocusTrap";
import {
  GOOD_WINDOW_MS,
  evaluateTrial,
  expectedSubdivisionTimes,
  judgeOffset,
} from "./systems/judgement";
import {
  DEFAULT_SAVE,
  SAVE_KEY,
  loadSave,
  persistSave,
} from "./storage";
import type {
  BestScore,
  GamePhase,
  GameScreen,
  GameSettings,
  Judgement,
  RunSchedule,
  SaveData,
  Subdivision,
  TrialEvaluation,
} from "./types";

type FeedbackState = {
  judgement: Judgement;
  message: string;
  key: number;
} | null;

type ResultSummary = BestScore & {
  newBest: boolean;
};

const ERROR_FEEDBACK = {
  extra: "연료가 너무 많아요. 다음 박의 시작을 기다려요.",
  missing: "빈 연료칸이 있어요. 칸 수를 먼저 확인해요.",
  early: "조금 빨랐어요. 별빛 파동이 닿을 때 눌러요.",
  late: "조금 늦었어요. 박의 첫 지점을 먼저 잡아 봐요.",
  uneven: "빠르게보다 고르게! 칸 사이를 같은 간격으로 나눠요.",
  none: "네 칸의 간격이 안정적이에요.",
} as const;

function clampLevel(level: number): number {
  return Math.max(1, Math.min(8, level));
}

function getGrade(score: number): string {
  if (score >= 92) return "S";
  if (score >= 82) return "A";
  if (score >= 70) return "B";
  return "C";
}

function getFeedbackMessage(
  evaluation: TrialEvaluation,
  quizTarget: Subdivision,
  theoryScore: number,
): string {
  if (theoryScore < 100 && quizTarget === 3) {
    return "한 박을 세 조각으로 나누는 느낌이었는지 다시 들어 볼까요?";
  }
  if (evaluation.mainError) return ERROR_FEEDBACK[evaluation.mainError];
  return "각 박의 경계와 조각 사이 간격을 모두 잘 지켰어요.";
}

function ToggleButton({
  checked,
  label,
  description,
  onChange,
}: {
  checked: boolean;
  label: string;
  description: string;
  onChange: (checked: boolean) => void;
}) {
  return (
    <button
      className="setting-toggle"
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
    >
      <span>
        <strong>{label}</strong>
        <small>{description}</small>
      </span>
      <span className="setting-toggle__track" aria-hidden="true">
        <span className="setting-toggle__thumb" />
      </span>
    </button>
  );
}

function SettingsDialog({
  open,
  settings,
  onChange,
  onClose,
  onReset,
}: {
  open: boolean;
  settings: GameSettings;
  onChange: (patch: Partial<GameSettings>) => void;
  onClose: () => void;
  onReset: () => void;
}) {
  const dialogRef = useFocusTrap<HTMLDivElement>(open);

  useEffect(() => {
    if (!open) return;
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [onClose, open]);

  if (!open) return null;

  return (
    <div className="dialog-backdrop">
      <div
        className="ui-dialog settings-dialog fx-enter-up"
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-title"
        ref={dialogRef}
      >
        <header className="dialog-heading">
          <div>
            <span className="eyebrow">FLIGHT CONTROL</span>
            <h2 id="settings-title">비행 설정</h2>
          </div>
          <button
            className="ui-icon-button"
            type="button"
            aria-label="설정 닫기"
            onClick={onClose}
          >
            <span aria-hidden="true">×</span>
          </button>
        </header>

        <div className="settings-list">
          <ToggleButton
            checked={settings.sound}
            label="소리"
            description="리듬 시범과 판정음을 재생해요"
            onChange={(sound) => onChange({ sound })}
          />
          <ToggleButton
            checked={settings.metronome}
            label="카운트인"
            description="출발 전 네 박을 들려줘요"
            onChange={(metronome) => onChange({ metronome })}
          />
          <ToggleButton
            checked={settings.haptics}
            label="진동"
            description="지원 기기에서 짧은 촉각 신호를 줘요"
            onChange={(haptics) => onChange({ haptics })}
          />
          <ToggleButton
            checked={settings.visualGuide}
            label="시각 보조 격자"
            description="청음 단계에서도 연료칸을 보여줘요"
            onChange={(visualGuide) => onChange({ visualGuide })}
          />
          <ToggleButton
            checked={settings.leftHanded}
            label="왼손 모드"
            description="보조 조작의 위치를 반대로 배치해요"
            onChange={(leftHanded) => onChange({ leftHanded })}
          />

          <fieldset className="motion-setting">
            <legend>모션 강도</legend>
            <div className="segmented-control">
              {(
                [
                  ["full", "전체"],
                  ["reduced", "줄임"],
                  ["minimal", "최소"],
                ] as const
              ).map(([value, label]) => (
                <button
                  className="segmented-control__button"
                  type="button"
                  aria-pressed={settings.motion === value}
                  onClick={() => onChange({ motion: value })}
                  key={value}
                >
                  {label}
                </button>
              ))}
            </div>
          </fieldset>

          <label className="calibration-control">
            <span>
              <strong>입력 지연 보정</strong>
              <output>{settings.calibrationMs > 0 ? "+" : ""}{settings.calibrationMs}ms</output>
            </span>
            <input
              type="range"
              min="-200"
              max="200"
              step="10"
              value={settings.calibrationMs}
              onChange={(event) =>
                onChange({ calibrationMs: Number(event.currentTarget.value) })
              }
              aria-label="입력 지연 보정, 마이너스 200에서 플러스 200밀리초"
            />
            <small>탭이 늘 늦게 잡히면 + 방향으로 조정하세요.</small>
          </label>
        </div>

        <footer className="dialog-actions">
          <button className="ui-button ui-button--quiet" type="button" onClick={onReset}>
            진행도 초기화
          </button>
          <button className="ui-button ui-button--primary" type="button" onClick={onClose}>
            설정 완료
          </button>
        </footer>
      </div>
    </div>
  );
}

export function RocketGame() {
  const audioRef = useRef(new AudioEngine());
  const scheduleRef = useRef<RunSchedule | null>(null);
  const inputsRef = useRef<number[][]>([[], [], [], []]);
  const finishGuardRef = useRef(false);
  const previousPhaseRef = useRef<GamePhase>("idle");
  const resumeTimersRef = useRef<number[]>([]);

  const [save, setSave] = useState<SaveData>(DEFAULT_SAVE);
  const [hydrated, setHydrated] = useState(false);
  const [screen, setScreen] = useState<GameScreen>("title");
  const [levelId, setLevelId] = useState(1);
  const [phase, setPhase] = useState<GamePhase>("idle");
  const [schedule, setSchedule] = useState<RunSchedule | null>(null);
  const [currentBeat, setCurrentBeat] = useState(0);
  const [visualFilled, setVisualFilled] = useState(0);
  const [inputCounts, setInputCounts] = useState([0, 0, 0, 0]);
  const [countDown, setCountDown] = useState(4);
  const [resumeCount, setResumeCount] = useState<number | null>(null);
  const [paused, setPaused] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [audioReady, setAudioReady] = useState(false);
  const [audioNotice, setAudioNotice] = useState("첫 탭에서 별빛 오디오를 준비해요");
  const [feedback, setFeedback] = useState<FeedbackState>(null);
  const [pulseKey, setPulseKey] = useState(0);
  const [evaluation, setEvaluation] = useState<TrialEvaluation | null>(null);
  const [quizSelected, setQuizSelected] = useState<Subdivision | null>(null);
  const [theoryScore, setTheoryScore] = useState(0);
  const [resultSummary, setResultSummary] = useState<ResultSummary | null>(null);
  const [listenBusy, setListenBusy] = useState(false);

  const level = useMemo(() => getLevel(levelId), [levelId]);
  const settings = save.settings;
  const currentSubdivision = level.pattern[Math.min(3, Math.max(0, currentBeat))];
  const showGuide = level.showGrid || settings.visualGuide;

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const loaded = loadSave();
      if (
        window.localStorage.getItem(SAVE_KEY) === null &&
        window.matchMedia("(prefers-reduced-motion: reduce)").matches
      ) {
        loaded.settings.motion = "minimal";
      }
      setSave(loaded);
      setHydrated(true);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    return () => {
      resumeTimersRef.current.forEach((timer) => window.clearTimeout(timer));
    };
  }, []);

  const updateSave = useCallback((updater: (current: SaveData) => SaveData) => {
    setSave((current) => {
      const next = updater(current);
      persistSave(next);
      return next;
    });
  }, []);

  const updateSettings = useCallback(
    (patch: Partial<GameSettings>) => {
      updateSave((current) => ({
        ...current,
        settings: { ...current.settings, ...patch },
      }));
    },
    [updateSave],
  );

  const ensureAudio = useCallback(async () => {
    const ready = await audioRef.current.unlock();
    setAudioReady(ready);
    setAudioNotice(
      ready
        ? "오디오 준비 완료"
        : "이 브라우저에서는 소리 대신 시각 격자로 진행해요",
    );
    return ready;
  }, []);

  const listenToSubdivision = useCallback(
    async (subdivision: Subdivision) => {
      if (listenBusy) return;
      await ensureAudio();
      audioRef.current.scheduleSingleSubdivision(subdivision, level.bpm, settings);
      setListenBusy(true);
      window.setTimeout(() => setListenBusy(false), Math.ceil((60 / level.bpm) * 1000));
    },
    [ensureAudio, level.bpm, listenBusy, settings],
  );

  const showResult = useCallback(
    (trial: TrialEvaluation, earnedTheoryScore: number) => {
      const total = Math.round(
        trial.performanceScore * 0.5 +
          earnedTheoryScore * 0.3 +
          trial.applicationScore * 0.2,
      );
      const previousBest = save.bestScores[level.id]?.total ?? 0;
      const nextBest: BestScore = {
        total,
        performance: trial.performanceScore,
        theory: earnedTheoryScore,
        application: trial.applicationScore,
      };
      setResultSummary({ ...nextBest, newBest: total > previousBest });
      updateSave((current) => ({
        ...current,
        unlockedLevel: clampLevel(Math.max(current.unlockedLevel, level.id + 1)),
        bestScores: {
          ...current.bestScores,
          [level.id]:
            total >= (current.bestScores[level.id]?.total ?? 0)
              ? nextBest
              : current.bestScores[level.id],
        },
        tutorialSeen: true,
      }));
      audioRef.current.clearJingle(settings.sound);
      setScreen("result");
      setPhase("complete");
    },
    [level.id, save.bestScores, settings.sound, updateSave],
  );

  const beginRun = useCallback(async () => {
    const ready = await audioRef.current.reset();
    setAudioReady(ready);
    setAudioNotice(
      ready ? "오디오 준비 완료" : "시각 격자 모드로 출발해요",
    );
    const secondsPerBeat = 60 / level.bpm;
    const now = audioRef.current.currentTime;
    const countInStart = now + 0.22;
    const demoStart = countInStart + secondsPerBeat * 4;
    const readyStart = demoStart + secondsPerBeat * 4;
    const playStart = readyStart + secondsPerBeat;
    const playEnd = playStart + secondsPerBeat * 4;
    const nextSchedule: RunSchedule = {
      countInStart,
      demoStart,
      readyStart,
      playStart,
      playEnd,
      secondsPerBeat,
    };

    audioRef.current.scheduleCountIn(countInStart, secondsPerBeat, settings);
    audioRef.current.schedulePattern(level.pattern, demoStart, secondsPerBeat, settings);
    audioRef.current.schedulePattern([1], readyStart, secondsPerBeat, settings);

    scheduleRef.current = nextSchedule;
    inputsRef.current = [[], [], [], []];
    finishGuardRef.current = false;
    setSchedule(nextSchedule);
    setInputCounts([0, 0, 0, 0]);
    setFeedback(null);
    setEvaluation(null);
    setResultSummary(null);
    setQuizSelected(null);
    setCurrentBeat(0);
    setVisualFilled(0);
    setCountDown(4);
    setPaused(false);
    setResumeCount(null);
    setPhase("count-in");
    setScreen("play");
  }, [level.bpm, level.pattern, settings]);

  useEffect(() => {
    if (screen !== "play" || !schedule) return;
    let frame = 0;
    let lastPhase: GamePhase | null = null;
    let lastBeat = -1;
    let lastFilled = -1;
    let lastCount = -1;

    const tick = () => {
      const now = audioRef.current.currentTime;
      let nextPhase: GamePhase;
      let beatIndex = 0;
      let filled = 0;

      if (paused || resumeCount !== null) {
        nextPhase = "paused";
      } else if (now < schedule.demoStart) {
        nextPhase = "count-in";
        const nextCount = Math.max(
          1,
          4 - Math.floor((now - schedule.countInStart) / schedule.secondsPerBeat),
        );
        if (nextCount !== lastCount) {
          lastCount = nextCount;
          setCountDown(nextCount);
        }
      } else if (now < schedule.readyStart) {
        nextPhase = "demo";
        beatIndex = Math.min(
          3,
          Math.max(0, Math.floor((now - schedule.demoStart) / schedule.secondsPerBeat)),
        );
        const subdivision = level.pattern[beatIndex];
        const beatProgress =
          ((now - schedule.demoStart) % schedule.secondsPerBeat) /
          schedule.secondsPerBeat;
        filled = Math.min(
          subdivision,
          Math.max(0, Math.floor(beatProgress * subdivision) + 1),
        );
      } else if (now < schedule.playStart) {
        nextPhase = "ready";
        beatIndex = 0;
      } else if (now < schedule.playEnd + GOOD_WINDOW_MS / 1000) {
        nextPhase = "playing";
        beatIndex = Math.min(
          3,
          Math.max(0, Math.floor((now - schedule.playStart) / schedule.secondsPerBeat)),
        );
        filled = inputCounts[beatIndex] ?? 0;
      } else {
        nextPhase = "complete";
        beatIndex = 3;
        filled = inputCounts[3] ?? 0;
        if (!finishGuardRef.current) {
          finishGuardRef.current = true;
          const trial = evaluateTrial(
            level.pattern,
            schedule.playStart,
            schedule.secondsPerBeat,
            inputsRef.current,
            level.applicationTrial,
          );
          setEvaluation(trial);
          if (level.quizOrder === "after") {
            setQuizSelected(null);
            setTheoryScore(0);
            setScreen("quiz");
          } else {
            showResult(trial, theoryScore);
          }
        }
      }

      if (nextPhase !== lastPhase) {
        lastPhase = nextPhase;
        setPhase(nextPhase);
      }
      if (beatIndex !== lastBeat) {
        lastBeat = beatIndex;
        setCurrentBeat(beatIndex);
      }
      if (filled !== lastFilled) {
        lastFilled = filled;
        setVisualFilled(filled);
      }
      frame = window.requestAnimationFrame(tick);
    };

    frame = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(frame);
  }, [
    inputCounts,
    level.applicationTrial,
    level.pattern,
    level.quizOrder,
    paused,
    resumeCount,
    schedule,
    screen,
    showResult,
    theoryScore,
  ]);

  const registerInput = useCallback(() => {
    if (screen !== "play" || phase !== "playing" || paused || resumeCount !== null) {
      return;
    }
    const activeSchedule = scheduleRef.current;
    if (!activeSchedule) return;
    const inputTime =
      audioRef.current.currentTime - settings.calibrationMs / 1000;
    if (
      inputTime < activeSchedule.playStart - GOOD_WINDOW_MS / 1000 ||
      inputTime > activeSchedule.playEnd + GOOD_WINDOW_MS / 1000
    ) {
      return;
    }

    let ownerBeat = Math.min(
      3,
      Math.max(
        0,
        Math.floor(
          (inputTime - activeSchedule.playStart) / activeSchedule.secondsPerBeat,
        ),
      ),
    );
    let nearestDistance = Number.POSITIVE_INFINITY;

    level.pattern.forEach((subdivision, beatIndex) => {
      const expected = expectedSubdivisionTimes(
        activeSchedule.playStart + beatIndex * activeSchedule.secondsPerBeat,
        activeSchedule.secondsPerBeat,
        subdivision,
      );
      const nextExpected = expected[inputsRef.current[beatIndex].length];
      if (nextExpected === undefined) return;
      const distance = Math.abs(nextExpected - inputTime);
      if (distance < nearestDistance && distance <= GOOD_WINDOW_MS / 1000) {
        nearestDistance = distance;
        ownerBeat = beatIndex;
      }
    });

    const subdivision = level.pattern[ownerBeat];
    const inputIndex = inputsRef.current[ownerBeat].length;
    inputsRef.current[ownerBeat].push(inputTime);
    const expected = expectedSubdivisionTimes(
      activeSchedule.playStart + ownerBeat * activeSchedule.secondsPerBeat,
      activeSchedule.secondsPerBeat,
      subdivision,
    )[inputIndex];
    const judgement: Judgement =
      expected === undefined
        ? "Miss"
        : judgeOffset((inputTime - expected) * 1000);
    const message =
      expected === undefined
        ? "연료 과다"
        : judgement === "Perfect"
          ? "정확한 점화"
          : judgement === "Good"
            ? "좋은 간격"
            : inputTime < expected
              ? "조금 빠름"
              : "조금 늦음";

    setInputCounts(inputsRef.current.map((inputs) => inputs.length));
    setCurrentBeat(ownerBeat);
    setVisualFilled(inputsRef.current[ownerBeat].length);
    setPulseKey((key) => key + 1);
    setFeedback((current) => ({
      judgement,
      message,
      key: (current?.key ?? 0) + 1,
    }));
    audioRef.current.inputFeedback(judgement, settings.sound);

    if (settings.haptics && "vibrate" in navigator) {
      const vibration = judgement === "Perfect" ? 12 : judgement === "Good" ? 8 : 20;
      navigator.vibrate(vibration);
    }
  }, [level.pattern, paused, phase, resumeCount, screen, settings]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (settingsOpen) return;
      if (event.key === "Escape" && screen === "play") {
        event.preventDefault();
        if (!paused) {
          previousPhaseRef.current = phase;
          void audioRef.current.suspend();
          setPaused(true);
          setPhase("paused");
        }
        return;
      }
      if (
        !event.repeat &&
        (event.code === "Space" || ["KeyA", "KeyS", "KeyD", "KeyF"].includes(event.code))
      ) {
        event.preventDefault();
        registerInput();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [paused, phase, registerInput, screen, settingsOpen]);

  useEffect(() => {
    const handleVisibility = () => {
      if (
        document.hidden &&
        screen === "play" &&
        !paused &&
        phase !== "complete"
      ) {
        previousPhaseRef.current = phase;
        void audioRef.current.suspend();
        setPaused(true);
        setPhase("paused");
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, [paused, phase, screen]);

  const pauseGame = useCallback(() => {
    previousPhaseRef.current = phase;
    void audioRef.current.suspend();
    setPaused(true);
    setPhase("paused");
  }, [phase]);

  const resumeGame = useCallback(() => {
    resumeTimersRef.current.forEach((timer) => window.clearTimeout(timer));
    resumeTimersRef.current = [];
    setPaused(false);
    setResumeCount(3);
    [2, 1].forEach((value, index) => {
      resumeTimersRef.current.push(
        window.setTimeout(() => setResumeCount(value), (index + 1) * 650),
      );
    });
    resumeTimersRef.current.push(
      window.setTimeout(async () => {
        setResumeCount(null);
        await audioRef.current.resume();
        setPhase(previousPhaseRef.current);
      }, 1950),
    );
  }, []);

  const chooseLevel = useCallback((nextLevelId: number) => {
    setLevelId(nextLevelId);
    setTheoryScore(0);
    setQuizSelected(null);
    setEvaluation(null);
    setResultSummary(null);
    setScreen("briefing");
  }, []);

  const beginFromBriefing = useCallback(async () => {
    if (level.quizOrder === "before") {
      await listenToSubdivision(level.quizTarget);
      setQuizSelected(null);
      setTheoryScore(0);
      setScreen("quiz");
    } else {
      await beginRun();
    }
  }, [beginRun, level.quizOrder, level.quizTarget, listenToSubdivision]);

  const answerQuiz = useCallback(
    (subdivision: Subdivision) => {
      setQuizSelected(subdivision);
      setTheoryScore(subdivision === level.quizTarget ? 100 : 35);
    },
    [level.quizTarget],
  );

  const continueAfterQuiz = useCallback(async () => {
    if (quizSelected === null) return;
    if (level.quizOrder === "before") {
      await beginRun();
    } else if (evaluation) {
      showResult(evaluation, theoryScore);
    }
  }, [beginRun, evaluation, level.quizOrder, quizSelected, showResult, theoryScore]);

  const replayFullPattern = useCallback(async () => {
    if (listenBusy) return;
    await ensureAudio();
    const secondsPerBeat = 60 / level.bpm;
    audioRef.current.schedulePattern(
      level.pattern,
      audioRef.current.currentTime + 0.12,
      secondsPerBeat,
      settings,
    );
    setListenBusy(true);
    window.setTimeout(
      () => setListenBusy(false),
      Math.ceil(secondsPerBeat * 4200),
    );
  }, [ensureAudio, level.bpm, level.pattern, listenBusy, settings]);

  const resetProgress = useCallback(() => {
    const reset: SaveData = {
      ...DEFAULT_SAVE,
      settings: save.settings,
    };
    persistSave(reset);
    setSave(reset);
    setLevelId(1);
    setScreen("title");
    setSettingsOpen(false);
  }, [save.settings]);

  const getAudioTime = useCallback(() => audioRef.current.currentTime, []);

  const renderTopBar = (title: string, backAction?: () => void) => (
    <header className="app-topbar">
      {backAction ? (
        <button
          className="ui-icon-button"
          type="button"
          aria-label="이전 화면"
          onClick={backAction}
        >
          <span aria-hidden="true">←</span>
        </button>
      ) : (
        <span className="brand-medallion" aria-hidden="true">★</span>
      )}
      <div className="app-topbar__title">
        <span>멜로디아 리듬 실험실</span>
        <strong>{title}</strong>
      </div>
      <button
        className="ui-icon-button"
        type="button"
        aria-label="설정 열기"
        onClick={() => setSettingsOpen(true)}
      >
        <span aria-hidden="true">⚙</span>
      </button>
    </header>
  );

  const renderTitle = () => (
    <section className="page-screen page-title fx-enter-up" aria-labelledby="game-title">
      <header className="title-header">
        <span className="eyebrow">MELODIA · RHYTHM LAB 04</span>
        <h1 id="game-title">분할 로켓</h1>
        <p>한 박을 고르게 나누고, 별빛 연료를 채워 발사하세요.</p>
      </header>

      <div className="title-stage theater-frame" aria-hidden="true">
        <RocketCanvas
          phase="idle"
          schedule={null}
          pattern={LEVELS[1].pattern}
          currentBeat={0}
          filledCount={0}
          judgement={null}
          pulseKey={0}
          motion={settings.motion}
          getAudioTime={getAudioTime}
        />
        <span className="stage-plaque">별빛 발사대 · 04</span>
      </div>

      <div className="title-actions">
        <button
          className="ui-button ui-button--primary ui-button--large"
          type="button"
          onClick={async () => {
            await ensureAudio();
            setScreen("levels");
          }}
          data-testid="start-game"
        >
          <span aria-hidden="true">✦</span>
          {save.unlockedLevel > 1 ? `${save.unlockedLevel}단계 이어하기` : "별빛 비행 시작"}
        </button>
        <div className="title-secondary-actions">
          <button className="ui-button ui-button--quiet" type="button" onClick={() => setScreen("guide")}>
            분할 도감
          </button>
          <button className="ui-button ui-button--quiet" type="button" onClick={() => setSettingsOpen(true)}>
            설정
          </button>
        </div>
      </div>

      <p className="audio-status" role="status">
        <span className={audioReady ? "status-light is-ready" : "status-light"} aria-hidden="true" />
        {audioNotice}
      </p>
    </section>
  );

  const renderLevels = () => (
    <section className="page-screen page-levels fx-enter-up" aria-labelledby="levels-title">
      {renderTopBar("비행 경로", () => setScreen("title"))}
      <div className="screen-heading">
        <div>
          <span className="eyebrow">8 SHORT FLIGHTS</span>
          <h1 id="levels-title">연료 패턴을 골라요</h1>
        </div>
        <div className="progress-chip" aria-label={`8단계 중 ${save.unlockedLevel}단계 해금`}>
          {save.unlockedLevel}/8 해금
        </div>
      </div>

      <ol className="level-grid">
        {LEVELS.map((item) => {
          const locked = item.id > save.unlockedLevel;
          const best = save.bestScores[item.id];
          return (
            <li key={item.id}>
              <button
                className="level-card ui-card"
                type="button"
                disabled={locked}
                onClick={() => chooseLevel(item.id)}
                aria-label={
                  locked
                    ? `${item.id}단계 잠김, 이전 단계를 완료하세요`
                    : `${item.id}단계 ${item.objective}${best ? `, 최고 ${best.total}점` : ""}`
                }
              >
                <span className="level-card__number">{String(item.id).padStart(2, "0")}</span>
                <span className="level-card__body">
                  <strong>{item.objective}</strong>
                  <span className="level-card__pattern">{patternLabel(item.pattern)}</span>
                  <small>{item.bpm} BPM · 약 35초</small>
                </span>
                <span className="level-card__status" aria-hidden="true">
                  {locked ? "⌁" : best ? `${best.total}` : "→"}
                </span>
              </button>
            </li>
          );
        })}
      </ol>
      <aside className="learning-note ui-card">
        <span className="learning-note__icon" aria-hidden="true">◇</span>
        <p><strong>비행 팁</strong> 빠르게 누르기보다 한 박 안의 간격을 똑같이 나눠 보세요.</p>
      </aside>
    </section>
  );

  const renderBriefing = () => (
    <section className="page-screen page-briefing fx-enter-up" aria-labelledby="briefing-title">
      {renderTopBar(`${level.id}단계`, () => setScreen("levels"))}
      <div className="briefing-layout">
        <div className="briefing-stage theater-frame">
          <RocketCanvas
            phase="idle"
            schedule={null}
            pattern={level.pattern}
            currentBeat={0}
            filledCount={0}
            judgement={null}
            pulseKey={0}
            motion={settings.motion}
            getAudioTime={getAudioTime}
          />
          <span className="stage-plaque">LEVEL {String(level.id).padStart(2, "0")}</span>
        </div>

        <article className="briefing-card ui-card">
          <span className="eyebrow">MISSION BRIEF</span>
          <h1 id="briefing-title">{level.objective}</h1>
          <p>{level.lesson}</p>
          <dl className="mission-facts">
            <div><dt>패턴</dt><dd>{patternLabel(level.pattern)}</dd></div>
            <div><dt>속도</dt><dd>{level.bpm} BPM</dd></div>
            <div><dt>박자표</dt><dd>{level.meter}</dd></div>
          </dl>
          <div className="pattern-preview" aria-label={`연료 패턴 ${patternLabel(level.pattern)}`}>
            {level.pattern.map((subdivision, index) => (
              <BeatFuelGrid
                subdivision={subdivision}
                filledCount={subdivision}
                showGuide
                compact
                label={`${index + 1}박`}
                key={`${subdivision}-${index}`}
              />
            ))}
          </div>
          {!level.showGrid ? (
            <p className="assistive-mode-note">
              <span aria-hidden="true">◉</span>
              이번 단계는 기본 격자를 숨겨 귀로 연습해요. 설정에서 시각 보조를 켤 수 있어요.
            </p>
          ) : null}
          <div className="briefing-actions">
            <button
              className="ui-button ui-button--secondary"
              type="button"
              disabled={listenBusy}
              onClick={() => void listenToSubdivision(level.quizTarget)}
            >
              <span aria-hidden="true">♪</span>
              {listenBusy ? "재생 중" : "핵심 리듬 듣기"}
            </button>
            <button className="ui-button ui-button--primary ui-button--large" type="button" onClick={() => void beginFromBriefing()}>
              {level.quizOrder === "before" ? "청음 도전 시작" : "카운트인 후 출발"}
            </button>
          </div>
          <p className="keyboard-hint">키보드: Space 또는 A · S · D · F</p>
        </article>
      </div>
    </section>
  );

  const renderPlay = () => {
    const filled = phase === "playing" || phase === "demo" ? visualFilled : 0;
    return (
      <section className="page-screen page-play" aria-labelledby="play-title">
        <header className="game-hud">
          <button className="hud-button" type="button" aria-label="게임 일시정지" onClick={pauseGame}>
            <span className="pause-mark" aria-hidden="true"><span /><span /></span>
          </button>
          <div className="hud-level">
            <small>LEVEL {level.id}</small>
            <strong id="play-title">{level.bpm} BPM · {level.meter}</strong>
          </div>
          <div className="hud-progress" aria-label={`4박 중 ${currentBeat + 1}박`}>
            {level.pattern.map((subdivision, index) => (
              <span
                className={index < currentBeat ? "is-complete" : index === currentBeat ? "is-current" : ""}
                key={`${subdivision}-${index}`}
              >
                {subdivision}
              </span>
            ))}
          </div>
          <div className="hud-combo">
            <small>FUEL</small>
            <strong>{inputCounts.reduce((sum, value) => sum + value, 0)}</strong>
          </div>
        </header>

        <div className="play-stage theater-frame" data-phase={phase}>
          <RocketCanvas
            phase={phase}
            schedule={schedule}
            pattern={level.pattern}
            currentBeat={currentBeat}
            filledCount={filled}
            judgement={feedback?.judgement ?? null}
            pulseKey={pulseKey}
            motion={settings.motion}
            getAudioTime={getAudioTime}
          />
          <div className="fuel-grid-overlay">
            <BeatFuelGrid
              subdivision={currentSubdivision}
              filledCount={filled}
              showGuide={showGuide || phase === "demo"}
              label={`${currentBeat + 1}박 · ${SUBDIVISION_COPY[currentSubdivision].name}`}
            />
            {!level.showGrid && settings.visualGuide ? (
              <span className="visual-assist-badge">시각 보조</span>
            ) : null}
          </div>

          {phase !== "playing" ? (
            <div className="phase-callout" role="status">
              {resumeCount !== null ? (
                <><strong>{resumeCount}</strong><span>다시 출발해요</span></>
              ) : phase === "count-in" ? (
                <><strong>{countDown}</strong><span>박을 준비해요</span></>
              ) : phase === "demo" ? (
                <><strong aria-hidden="true">♪</strong><span>먼저 들어요</span></>
              ) : phase === "ready" ? (
                <><strong>GO</strong><span>이제 내 차례</span></>
              ) : null}
            </div>
          ) : null}

          {feedback ? (
            <div
              className={`judgement-burst is-${feedback.judgement.toLowerCase()}`}
              key={feedback.key}
              aria-hidden="true"
            >
              <strong>{feedback.judgement}</strong>
              <span>{feedback.message}</span>
            </div>
          ) : null}
        </div>

        <div className="bottom-control-deck" data-handedness={settings.leftHanded ? "left" : "right"}>
          <div className="control-instruction">
            <span className="control-instruction__beat">{currentBeat + 1}</span>
            <p>
              <strong>{phase === "playing" ? `${currentSubdivision}칸을 고르게 채워요` : "시범이 끝나면 눌러요"}</strong>
              <span>{SUBDIVISION_COPY[currentSubdivision].chant}</span>
            </p>
          </div>
          <button
            className="rhythm-tap-button"
            type="button"
            onPointerDown={(event) => {
              event.preventDefault();
              registerInput();
            }}
            disabled={phase !== "playing" || paused || resumeCount !== null}
            aria-label={`연료 넣기, ${SUBDIVISION_COPY[currentSubdivision].chant}`}
            data-testid="rhythm-tap"
          >
            <span className="rhythm-tap-button__shine" aria-hidden="true" />
            <span className="rhythm-tap-button__icon" aria-hidden="true">♪</span>
            <strong>연료 탭</strong>
            <small>SPACE</small>
          </button>
          <div className="control-key-row" aria-hidden="true">
            {['A', 'S', 'D', 'F'].map((key) => <kbd key={key}>{key}</kbd>)}
          </div>
        </div>

        {paused ? (
          <div className="dialog-backdrop">
            <div className="ui-dialog pause-dialog fx-enter-up" role="dialog" aria-modal="true" aria-labelledby="pause-title">
              <span className="brand-medallion" aria-hidden="true">★</span>
              <h2 id="pause-title">별빛 비행 일시정지</h2>
              <p>오디오 시계와 로켓이 함께 멈췄어요.</p>
              <div className="dialog-actions dialog-actions--stacked">
                <button className="ui-button ui-button--primary" type="button" onClick={resumeGame}>3-2-1 다시 시작</button>
                <button className="ui-button ui-button--secondary" type="button" onClick={() => void beginRun()}>처음부터</button>
                <button className="ui-button ui-button--quiet" type="button" onClick={() => setSettingsOpen(true)}>설정</button>
                <button className="ui-button ui-button--quiet" type="button" onClick={async () => {
                  await audioRef.current.reset();
                  setPaused(false);
                  setPhase("idle");
                  setScreen("levels");
                }}>비행 나가기</button>
              </div>
            </div>
          </div>
        ) : null}
      </section>
    );
  };

  const renderQuiz = () => {
    const correct = quizSelected === level.quizTarget;
    return (
      <section className="page-screen page-quiz fx-enter-up" aria-labelledby="quiz-title">
        {renderTopBar("기보 확인", () => setScreen("briefing"))}
        <div className="quiz-heading">
          <span className="eyebrow">LISTEN → NOTATION</span>
          <h1 id="quiz-title">
            {level.quizOrder === "before" ? "첫 박을 몇 조각으로 들었나요?" : "비행의 핵심 분할은 무엇이었나요?"}
          </h1>
          <p>리듬을 다시 듣고, 알맞은 기보 카드를 골라요.</p>
        </div>

        <button
          className="listen-orb"
          type="button"
          disabled={listenBusy}
          onClick={() => void listenToSubdivision(level.quizTarget)}
          aria-label={`${SUBDIVISION_COPY[level.quizTarget].name} 리듬 다시 듣기`}
        >
          <span aria-hidden="true">♪</span>
          <strong>{listenBusy ? "재생 중" : "리듬 다시 듣기"}</strong>
        </button>

        <div className="quiz-grid" role="group" aria-label="분할 기보 선택">
          {([1, 2, 3, 4] as const).map((subdivision) => {
            const selected = quizSelected === subdivision;
            const answerState = quizSelected === null
              ? "idle"
              : subdivision === level.quizTarget
                ? "correct"
                : selected
                  ? "wrong"
                  : "idle";
            return (
              <button
                className="notation-card ui-card"
                type="button"
                data-answer-state={answerState}
                aria-pressed={selected}
                onClick={() => answerQuiz(subdivision)}
                key={subdivision}
              >
                <span className="notation-card__number">{subdivision}</span>
                <span className="notation-card__symbol" aria-hidden="true">{SUBDIVISION_COPY[subdivision].notation}</span>
                <strong>{SUBDIVISION_COPY[subdivision].name}</strong>
                <small>{SUBDIVISION_COPY[subdivision].chant}</small>
                {answerState === "correct" ? <span className="answer-badge" aria-label="정답">✓</span> : null}
                {answerState === "wrong" ? <span className="answer-badge is-wrong" aria-label="선택한 오답">×</span> : null}
              </button>
            );
          })}
        </div>

        {quizSelected !== null ? (
          <div className={`learning-feedback ${correct ? "is-correct" : "is-wrong"}`} role="status">
            <span aria-hidden="true">{correct ? "✓" : "◇"}</span>
            <div>
              <strong>{correct ? "정확해요!" : `정답은 ${SUBDIVISION_COPY[level.quizTarget].name}`}</strong>
              <p>{correct
                ? `${SUBDIVISION_COPY[level.quizTarget].chant}, 한 박의 칸 수를 잘 들었어요.`
                : level.quizTarget === 3
                  ? "한 박을 세 조각으로 나누는 느낌인지 다시 들어 보세요."
                  : "한 박 안에서 같은 간격으로 들린 소리의 수를 세어 보세요."}</p>
            </div>
            <button className="ui-button ui-button--primary" type="button" onClick={() => void continueAfterQuiz()}>
              {level.quizOrder === "before" ? "이 리듬으로 연주" : "비행 결과 보기"}
            </button>
          </div>
        ) : null}
      </section>
    );
  };

  const renderResult = () => {
    if (!evaluation || !resultSummary) return null;
    const nextLevel = Math.min(8, level.id + 1);
    return (
      <section className="page-screen page-result fx-enter-up" aria-labelledby="result-title">
        {renderTopBar("비행 보고서", () => setScreen("levels"))}
        <header className="result-hero">
          <div className="grade-medallion" aria-label={`총 등급 ${getGrade(resultSummary.total)}`}>
            <span>{getGrade(resultSummary.total)}</span>
          </div>
          <div>
            <span className="eyebrow">FLIGHT COMPLETE</span>
            <h1 id="result-title">별빛 궤도에 도착했어요!</h1>
            <p>{getFeedbackMessage(evaluation, level.quizTarget, theoryScore)}</p>
          </div>
          {resultSummary.newBest ? <span className="new-best-badge">★ 최고 기록</span> : null}
        </header>

        <div className="score-grid" aria-label="학습 점수 세 항목">
          <article className="score-card ui-card">
            <span className="score-card__icon" aria-hidden="true">♪</span>
            <span>연주 정확도</span>
            <strong>{resultSummary.performance}</strong>
            <small>50% 반영</small>
          </article>
          <article className="score-card ui-card">
            <span className="score-card__icon" aria-hidden="true">♩</span>
            <span>기보 이해</span>
            <strong>{resultSummary.theory}</strong>
            <small>30% 반영</small>
          </article>
          <article className="score-card ui-card">
            <span className="score-card__icon" aria-hidden="true">✦</span>
            <span>새 패턴 응용</span>
            <strong>{resultSummary.application}</strong>
            <small>20% 반영</small>
          </article>
        </div>

        <div className="judgement-summary ui-card" aria-label="판정 횟수">
          <div><span className="judgement-dot is-perfect" aria-hidden="true" /><strong>{evaluation.perfect}</strong><small>Perfect</small></div>
          <div><span className="judgement-dot is-good" aria-hidden="true" /><strong>{evaluation.good}</strong><small>Good</small></div>
          <div><span className="judgement-dot is-miss" aria-hidden="true" /><strong>{evaluation.miss}</strong><small>Miss</small></div>
          <div className="total-score"><span>종합</span><strong>{resultSummary.total}</strong><small>/ 100</small></div>
        </div>

        <TimingGraph beats={evaluation.beats} />

        <article className="theory-connection ui-card">
          <span className="theory-connection__label">오늘의 연결</span>
          <div className="theory-connection__pattern" aria-label={`연주한 패턴 ${patternLabel(level.pattern)}`}>
            {level.pattern.map((subdivision, index) => (
              <span key={`${subdivision}-${index}`}>
                <b aria-hidden="true">{SUBDIVISION_COPY[subdivision].notation}</b>
                <small>{subdivision}분할</small>
              </span>
            ))}
          </div>
          <p>모든 박의 길이는 같지만, 박 안을 나누는 칸 수와 간격이 달라져요.</p>
          <button className="ui-button ui-button--quiet" type="button" disabled={listenBusy} onClick={() => void replayFullPattern()}>
            <span aria-hidden="true">♪</span> 전체 패턴 다시 듣기
          </button>
        </article>

        <div className="result-actions">
          <button className="ui-button ui-button--secondary" type="button" onClick={() => void beginRun()}>다시 비행</button>
          {level.id < 8 ? (
            <button className="ui-button ui-button--primary ui-button--large" type="button" onClick={() => chooseLevel(nextLevel)}>
              다음 단계 · {nextLevel}
            </button>
          ) : (
            <button className="ui-button ui-button--primary ui-button--large" type="button" onClick={() => setScreen("levels")}>
              비행 경로로
            </button>
          )}
        </div>
      </section>
    );
  };

  const renderGuide = () => (
    <section className="page-screen page-guide fx-enter-up" aria-labelledby="guide-title">
      {renderTopBar("분할 도감", () => setScreen("title"))}
      <div className="screen-heading">
        <div>
          <span className="eyebrow">ONE BEAT · FOUR WAYS</span>
          <h1 id="guide-title">한 박을 어떻게 나눌까요?</h1>
        </div>
      </div>
      <p className="guide-intro">한 박의 전체 길이는 같아요. 안에 들어가는 소리의 수와 간격만 달라져요.</p>
      <div className="guide-list">
        {([1, 2, 3, 4] as const).map((subdivision) => (
          <article className="guide-card ui-card" key={subdivision}>
            <BeatFuelGrid subdivision={subdivision} filledCount={subdivision} showGuide label={SUBDIVISION_COPY[subdivision].name} />
            <div className="guide-card__copy">
              <p>{subdivision === 1
                ? "박의 시작에 한 번 눌러 기준을 세워요."
                : subdivision === 2
                  ? "한 박의 절반과 절반을 같은 간격으로 눌러요."
                  : subdivision === 3
                    ? "한 박을 정확히 3등분해요. 2분할보다 간격이 좁아요."
                    : "한 박을 네 칸으로 나눠 같은 폭으로 점화해요."}</p>
              <button className="ui-button ui-button--quiet" type="button" disabled={listenBusy} onClick={() => void listenToSubdivision(subdivision)}>
                <span aria-hidden="true">♪</span> {SUBDIVISION_COPY[subdivision].chant} 듣기
              </button>
            </div>
          </article>
        ))}
      </div>
      <aside className="guide-rule ui-card">
        <strong>기억할 규칙</strong>
        <p>빠르게 여러 번 누르는 것보다, 한 박의 시작과 끝 사이를 고르게 나누는 것이 더 중요해요.</p>
      </aside>
    </section>
  );

  if (!hydrated) {
    return (
      <main className="game-app" data-game-theme="subdivision-rocket">
        <div className="game-shell loading-shell" role="status" aria-label="분할 로켓 준비 중">
          <span className="brand-medallion fx-pulse-soft" aria-hidden="true">★</span>
          <p>별빛 발사대를 준비하고 있어요…</p>
        </div>
      </main>
    );
  }

  return (
    <main
      className="game-app"
      data-game-theme="subdivision-rocket"
      data-motion={settings.motion}
      data-screen={screen}
    >
      <div className="ambient-stars" aria-hidden="true">
        {Array.from({ length: 12 }, (_, index) => <span key={index} />)}
      </div>
      <div className="game-shell">
        {screen === "title" ? renderTitle() : null}
        {screen === "levels" ? renderLevels() : null}
        {screen === "briefing" ? renderBriefing() : null}
        {screen === "play" ? renderPlay() : null}
        {screen === "quiz" ? renderQuiz() : null}
        {screen === "result" ? renderResult() : null}
        {screen === "guide" ? renderGuide() : null}
      </div>

      <SettingsDialog
        open={settingsOpen}
        settings={settings}
        onChange={updateSettings}
        onClose={() => setSettingsOpen(false)}
        onReset={resetProgress}
      />
      <div className="u-visually-hidden" aria-live="polite">
        {screen === "result" && resultSummary
          ? `비행 완료. 종합 ${resultSummary.total}점, 연주 ${resultSummary.performance}점, 이론 ${resultSummary.theory}점, 응용 ${resultSummary.application}점.`
          : ""}
      </div>
    </main>
  );
}

export default RocketGame;
