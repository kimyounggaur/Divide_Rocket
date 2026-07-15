import { SUBDIVISION_COPY } from "../data/levels";
import type { Subdivision } from "../types";

export interface BeatFuelGridProps {
  subdivision: Subdivision;
  filledCount: number;
  showGuide: boolean;
  compact?: boolean;
  label?: string;
}

function clampFilledCount(value: number, subdivision: Subdivision): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(subdivision, Math.max(0, Math.floor(value)));
}

export function BeatFuelGrid({
  subdivision,
  filledCount,
  showGuide,
  compact = false,
  label,
}: BeatFuelGridProps) {
  const copy = SUBDIVISION_COPY[subdivision];
  const normalizedFilledCount = clampFilledCount(filledCount, subdivision);
  const displayLabel = label?.trim() || copy.name;
  const rootClassName = [
    "beat-fuel-grid",
    `beat-fuel-grid--subdivision-${subdivision}`,
    subdivision === 3 ? "beat-fuel-grid--triplet" : "",
    subdivision === 4 ? "beat-fuel-grid--sixteenths" : "",
    compact ? "beat-fuel-grid--compact" : "",
    showGuide ? "beat-fuel-grid--guide-visible" : "beat-fuel-grid--guide-hidden",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <section
      className={rootClassName}
      data-subdivision={subdivision}
      aria-label={`${displayLabel}, 구호 ${copy.chant}. 연료 ${normalizedFilledCount}/${subdivision}칸 채움`}
    >
      <header className="beat-fuel-grid__header">
        <span className="beat-fuel-grid__label">{displayLabel}</span>
        <span className="beat-fuel-grid__notation" aria-hidden="true">
          {copy.notation}
        </span>
      </header>

      <div className="beat-fuel-grid__frame">
        {subdivision === 3 ? (
          <span className="beat-fuel-grid__triplet-frame" aria-hidden="true">
            <span className="beat-fuel-grid__triplet-edge beat-fuel-grid__triplet-edge--left" />
            <span className="beat-fuel-grid__triplet-edge beat-fuel-grid__triplet-edge--right" />
            <span className="beat-fuel-grid__triplet-edge beat-fuel-grid__triplet-edge--base" />
          </span>
        ) : null}

        <ol
          className="beat-fuel-grid__cells"
          aria-label={`${copy.short} 연료 진행도`}
        >
          {Array.from({ length: subdivision }, (_, index) => {
            const isFilled = index < normalizedFilledCount;

            return (
              <li
                className={[
                  "beat-fuel-grid__cell",
                  isFilled
                    ? "beat-fuel-grid__cell--filled"
                    : "beat-fuel-grid__cell--empty",
                  !showGuide && !isFilled
                    ? "beat-fuel-grid__cell--guide-concealed"
                    : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
                key={index}
                aria-label={`${index + 1}번째 연료 칸, ${isFilled ? "채움" : "비어 있음"}`}
              >
                <span className="beat-fuel-grid__fuel" aria-hidden="true" />
              </li>
            );
          })}
        </ol>
      </div>

      <footer className="beat-fuel-grid__footer">
        <span className="beat-fuel-grid__chant">{copy.chant}</span>
        <span className="beat-fuel-grid__count" aria-hidden="true">
          {normalizedFilledCount}/{subdivision}
        </span>
      </footer>
    </section>
  );
}

export default BeatFuelGrid;
