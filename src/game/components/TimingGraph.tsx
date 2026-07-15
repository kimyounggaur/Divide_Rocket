import type { CSSProperties } from "react";

import { SUBDIVISION_COPY } from "../data/levels";
import type { BeatError, BeatEvaluation, Judgement } from "../types";

export interface TimingGraphProps {
  beats: BeatEvaluation[];
}

const OFFSET_LIMIT_MS = 160;

const JUDGEMENT_COPY: Record<Judgement, string> = {
  Perfect: "정확",
  Good: "좋음",
  Miss: "놓침",
};

const ERROR_COPY: Record<Exclude<BeatError, null>, string> = {
  extra: "입력 과다",
  missing: "입력 부족",
  early: "너무 빠름",
  late: "너무 늦음",
  uneven: "간격 불균일",
};

type TimingDotStyle = CSSProperties & {
  "--timing-position": string;
};

function clampOffset(offsetMs: number): number {
  return Math.min(OFFSET_LIMIT_MS, Math.max(-OFFSET_LIMIT_MS, offsetMs));
}

function timingDotStyle(offsetMs: number): TimingDotStyle {
  const safeOffset = Number.isFinite(offsetMs) ? offsetMs : 0;
  const clampedOffset = clampOffset(safeOffset);
  const position =
    ((clampedOffset + OFFSET_LIMIT_MS) / (OFFSET_LIMIT_MS * 2)) * 100;

  return { "--timing-position": `${position}%` };
}

function formatOffset(offsetMs: number | null): string {
  if (offsetMs === null || !Number.isFinite(offsetMs)) return "입력 없음";

  const roundedOffset = Math.round(offsetMs);
  if (roundedOffset === 0) return "0ms";
  return `${roundedOffset > 0 ? "+" : "−"}${Math.abs(roundedOffset)}ms`;
}

function hitAriaLabel(
  hitIndex: number,
  offsetMs: number | null,
  judgement: Judgement,
): string {
  if (offsetMs === null || !Number.isFinite(offsetMs)) {
    return `${hitIndex + 1}번째 기대 입력, 실제 입력 없음, 놓침`;
  }

  const direction = offsetMs < 0 ? "빠름" : offsetMs > 0 ? "늦음" : "정확";
  const outsideGraph = Math.abs(offsetMs) > OFFSET_LIMIT_MS
    ? ", 그래프 범위 끝에 표시"
    : "";

  return `${hitIndex + 1}번째 기대 입력, ${direction} ${Math.abs(
    Math.round(offsetMs),
  )}밀리초, ${JUDGEMENT_COPY[judgement]}${outsideGraph}`;
}

export function TimingGraph({ beats }: TimingGraphProps) {
  return (
    <section className="timing-graph" aria-label="박별 입력 타이밍 분석">
      <header className="timing-graph__header">
        <div>
          <p className="timing-graph__eyebrow">TIMING REPORT</p>
          <h2 className="timing-graph__title">박별 타이밍</h2>
        </div>
        <span className="timing-graph__range">±{OFFSET_LIMIT_MS}ms</span>
      </header>

      <div className="timing-graph__axis" aria-hidden="true">
        <span className="timing-graph__axis-label timing-graph__axis-label--early">
          빠름 −{OFFSET_LIMIT_MS}ms
        </span>
        <span className="timing-graph__axis-label timing-graph__axis-label--on-time">
          정확 0ms
        </span>
        <span className="timing-graph__axis-label timing-graph__axis-label--late">
          늦음 +{OFFSET_LIMIT_MS}ms
        </span>
      </div>

      {beats.length > 0 ? (
        <ol className="timing-graph__beats">
          {beats.map((beat) => {
            const copy = SUBDIVISION_COPY[beat.subdivision];
            const judgementClass = beat.judgement.toLowerCase();

            return (
              <li className="timing-graph__beat-item" key={beat.beatIndex}>
                <article
                  className={`timing-graph__beat timing-graph__beat--${judgementClass}`}
                  aria-label={`${beat.beatIndex + 1}박, ${copy.name}, ${JUDGEMENT_COPY[beat.judgement]}, ${beat.score}점`}
                >
                  <header className="timing-graph__beat-header">
                    <div className="timing-graph__beat-label">
                      <strong>{beat.beatIndex + 1}박</strong>
                      <span>{copy.short}</span>
                    </div>
                    <div className="timing-graph__beat-result">
                      <span
                        className={`timing-graph__judgement timing-graph__judgement--${judgementClass}`}
                      >
                        {beat.judgement}
                      </span>
                      <span className="timing-graph__score">{beat.score}점</span>
                    </div>
                  </header>

                  <ol
                    className={`timing-graph__track timing-graph__track--subdivision-${beat.subdivision}`}
                    aria-label={`${copy.name}의 ${beat.hits.length}개 기대 입력`}
                  >
                    {beat.hits.map((hit, hitIndex) => {
                      const offset = hit.offsetMs;
                      const hasActual = offset !== null && Number.isFinite(offset);
                      const isClamped = hasActual && Math.abs(offset) > OFFSET_LIMIT_MS;
                      const hitJudgementClass = hit.judgement.toLowerCase();

                      return (
                        <li
                          className={[
                            "timing-graph__hit-lane",
                            `timing-graph__hit-lane--${hitJudgementClass}`,
                            isClamped ? "timing-graph__hit-lane--clamped" : "",
                            !hasActual ? "timing-graph__hit-lane--missing" : "",
                          ]
                            .filter(Boolean)
                            .join(" ")}
                          key={hitIndex}
                          aria-label={hitAriaLabel(
                            hitIndex,
                            hasActual ? offset : null,
                            hit.judgement,
                          )}
                        >
                          <div className="timing-graph__offset-track" aria-hidden="true">
                            <span className="timing-graph__track-line" />
                            <span className="timing-graph__expected-tick" />
                            {hasActual ? (
                              <span
                                className={`timing-graph__actual-dot timing-graph__actual-dot--${hitJudgementClass}`}
                                style={timingDotStyle(offset)}
                              />
                            ) : (
                              <span className="timing-graph__missing-mark">×</span>
                            )}
                          </div>
                          <span className="timing-graph__hit-label">
                            {formatOffset(hasActual ? offset : null)}
                          </span>
                        </li>
                      );
                    })}
                  </ol>

                  {beat.error ? (
                    <p className="timing-graph__error">
                      {ERROR_COPY[beat.error]}
                      {beat.extraInputs > 0 ? ` · +${beat.extraInputs}회` : ""}
                    </p>
                  ) : null}
                </article>
              </li>
            );
          })}
        </ol>
      ) : (
        <p className="timing-graph__empty" role="status">
          아직 분석할 타이밍 기록이 없어요.
        </p>
      )}

      <ul className="timing-graph__legend" aria-label="타이밍 그래프 범례">
        <li>
          <span className="timing-graph__legend-tick" aria-hidden="true" />
          기대 시각
        </li>
        <li>
          <span className="timing-graph__legend-dot" aria-hidden="true" />
          실제 입력
        </li>
        <li>
          <span className="timing-graph__legend-missing" aria-hidden="true">
            ×
          </span>
          입력 없음
        </li>
      </ul>
    </section>
  );
}

export default TimingGraph;
