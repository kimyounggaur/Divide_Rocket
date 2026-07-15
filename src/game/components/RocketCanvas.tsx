"use client";

import { useEffect, useRef } from "react";

import type {
  GamePhase,
  Judgement,
  MotionMode,
  RunSchedule,
  Subdivision,
} from "../types";

const LOGICAL_WIDTH = 360;
const LOGICAL_HEIGHT = 330;
const PARTICLE_POOL_SIZE = 16;

interface RocketCanvasProps {
  phase: GamePhase;
  schedule: RunSchedule | null;
  pattern: readonly Subdivision[];
  currentBeat: number;
  filledCount: number;
  judgement: Judgement | null;
  pulseKey: number;
  motion: MotionMode;
  getAudioTime: () => number;
}

interface CanvasPalette {
  paper: string;
  paperLight: string;
  paperShade: string;
  navy: string;
  navyDeep: string;
  skyTop: string;
  skyBottom: string;
  cloud: string;
  cloudShade: string;
  purple: string;
  purpleDeep: string;
  brass: string;
  brassLight: string;
  teal: string;
  mint: string;
  flame: string;
  flameHot: string;
  star: string;
  ink: string;
  shadow: string;
  miss: string;
}

type ParticleKind = "spark" | "exhaust" | "smoke";
type ParticleTone = "mint" | "star" | "flame" | "cloudShade" | "miss";

interface Particle {
  active: boolean;
  kind: ParticleKind;
  tone: ParticleTone;
  x: number;
  y: number;
  vx: number;
  vy: number;
  gravity: number;
  age: number;
  life: number;
  size: number;
  rotation: number;
  spin: number;
}

interface StarPoint {
  x: number;
  y: number;
  size: number;
  phase: number;
}

const STAR_POINTS: readonly StarPoint[] = Array.from(
  { length: 30 },
  (_, index) => ({
    x: 42 + ((index * 67) % 277),
    y: 60 + ((index * 43) % 147),
    size: 0.8 + (index % 4) * 0.38,
    phase: (index * 0.73) % (Math.PI * 2),
  }),
);

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function easeOutCubic(value: number): number {
  return 1 - (1 - value) ** 3;
}

function roundedRectPath(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
): void {
  const safeRadius = Math.min(radius, width / 2, height / 2);
  context.beginPath();
  context.moveTo(x + safeRadius, y);
  context.lineTo(x + width - safeRadius, y);
  context.quadraticCurveTo(x + width, y, x + width, y + safeRadius);
  context.lineTo(x + width, y + height - safeRadius);
  context.quadraticCurveTo(
    x + width,
    y + height,
    x + width - safeRadius,
    y + height,
  );
  context.lineTo(x + safeRadius, y + height);
  context.quadraticCurveTo(x, y + height, x, y + height - safeRadius);
  context.lineTo(x, y + safeRadius);
  context.quadraticCurveTo(x, y, x + safeRadius, y);
  context.closePath();
}

function stageOpeningPath(context: CanvasRenderingContext2D): void {
  context.beginPath();
  context.moveTo(21, 285);
  context.lineTo(21, 78);
  context.quadraticCurveTo(21, 43, 59, 39);
  context.quadraticCurveTo(78, 21, 104, 35);
  context.lineTo(256, 35);
  context.quadraticCurveTo(282, 21, 301, 39);
  context.quadraticCurveTo(339, 43, 339, 78);
  context.lineTo(339, 285);
  context.closePath();
}

function readColor(
  styles: CSSStyleDeclaration,
  names: readonly string[],
  fallback: string,
): string {
  for (const name of names) {
    const value = styles.getPropertyValue(name).trim();
    if (value) return value;
  }
  return fallback;
}

function readPalette(canvas: HTMLCanvasElement): CanvasPalette {
  const styles = getComputedStyle(canvas);

  return {
    paper: readColor(
      styles,
      ["--rocket-paper", "--game-paper", "--paper", "--cream"],
      "ivory",
    ),
    paperLight: readColor(
      styles,
      ["--rocket-paper-light", "--game-paper-light", "--paper-light"],
      "floralwhite",
    ),
    paperShade: readColor(
      styles,
      ["--rocket-paper-shade", "--game-paper-shade", "--paper-shade"],
      "wheat",
    ),
    navy: readColor(
      styles,
      ["--rocket-navy", "--game-navy", "--navy"],
      "midnightblue",
    ),
    navyDeep: readColor(
      styles,
      ["--rocket-navy-deep", "--game-navy-deep", "--navy-deep"],
      "darkslategray",
    ),
    skyTop: readColor(
      styles,
      ["--rocket-sky-top", "--game-sky-top", "--sky-top"],
      "darkslategray",
    ),
    skyBottom: readColor(
      styles,
      ["--rocket-sky-bottom", "--game-sky-bottom", "--sky-bottom"],
      "teal",
    ),
    cloud: readColor(
      styles,
      ["--rocket-cloud", "--game-cloud", "--cloud"],
      "lightsteelblue",
    ),
    cloudShade: readColor(
      styles,
      ["--rocket-cloud-shade", "--game-cloud-shade", "--cloud-shade"],
      "slategray",
    ),
    purple: readColor(
      styles,
      ["--rocket-purple", "--game-purple", "--purple"],
      "mediumpurple",
    ),
    purpleDeep: readColor(
      styles,
      ["--rocket-purple-deep", "--game-purple-deep", "--purple-deep"],
      "rebeccapurple",
    ),
    brass: readColor(
      styles,
      ["--rocket-brass", "--game-brass", "--brass", "--gold"],
      "goldenrod",
    ),
    brassLight: readColor(
      styles,
      ["--rocket-brass-light", "--game-brass-light", "--brass-light"],
      "khaki",
    ),
    teal: readColor(
      styles,
      ["--rocket-teal", "--game-teal", "--teal"],
      "cadetblue",
    ),
    mint: readColor(
      styles,
      ["--rocket-mint", "--game-mint", "--mint"],
      "aquamarine",
    ),
    flame: readColor(
      styles,
      ["--rocket-flame", "--game-flame", "--flame"],
      "gold",
    ),
    flameHot: readColor(
      styles,
      ["--rocket-flame-hot", "--game-flame-hot", "--flame-hot"],
      "lightyellow",
    ),
    star: readColor(
      styles,
      ["--rocket-star", "--game-star", "--star"],
      "khaki",
    ),
    ink: readColor(
      styles,
      ["--rocket-ink", "--game-ink", "--ink", "--foreground"],
      "darkslategray",
    ),
    shadow: readColor(
      styles,
      ["--rocket-shadow", "--game-shadow", "--shadow"],
      "black",
    ),
    miss: readColor(
      styles,
      ["--rocket-miss", "--game-miss", "--miss"],
      "indianred",
    ),
  };
}

function drawStar(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  outerRadius: number,
  innerRadius: number,
  rotation = 0,
): void {
  context.beginPath();
  for (let point = 0; point < 10; point += 1) {
    const radius = point % 2 === 0 ? outerRadius : innerRadius;
    const angle = rotation - Math.PI / 2 + (point * Math.PI) / 5;
    const pointX = x + Math.cos(angle) * radius;
    const pointY = y + Math.sin(angle) * radius;
    if (point === 0) context.moveTo(pointX, pointY);
    else context.lineTo(pointX, pointY);
  }
  context.closePath();
}

function drawCloud(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  scale: number,
  palette: CanvasPalette,
): void {
  const cloudShape = (offsetY: number): void => {
    context.beginPath();
    context.ellipse(x - 30 * scale, y + offsetY, 31 * scale, 16 * scale, 0, 0, Math.PI * 2);
    context.ellipse(x - 6 * scale, y - 10 * scale + offsetY, 27 * scale, 23 * scale, 0, 0, Math.PI * 2);
    context.ellipse(x + 22 * scale, y - 3 * scale + offsetY, 33 * scale, 20 * scale, 0, 0, Math.PI * 2);
    context.ellipse(x + 47 * scale, y + 4 * scale + offsetY, 23 * scale, 14 * scale, 0, 0, Math.PI * 2);
  };

  context.save();
  context.globalAlpha = 0.56;
  context.fillStyle = palette.cloudShade;
  cloudShape(6 * scale);
  context.fill();
  context.globalAlpha = 0.84;
  context.fillStyle = palette.cloud;
  cloudShape(0);
  context.fill();
  context.restore();
}

function drawPaperFrame(
  context: CanvasRenderingContext2D,
  palette: CanvasPalette,
): void {
  context.save();
  context.shadowColor = palette.shadow;
  context.shadowBlur = 8;
  context.shadowOffsetY = 3;
  const panelGradient = context.createLinearGradient(0, 0, 0, LOGICAL_HEIGHT);
  panelGradient.addColorStop(0, palette.paperLight);
  panelGradient.addColorStop(1, palette.paperShade);
  roundedRectPath(context, 3, 3, LOGICAL_WIDTH - 6, LOGICAL_HEIGHT - 6, 19);
  context.fillStyle = panelGradient;
  context.fill();
  context.shadowBlur = 0;
  context.strokeStyle = palette.brass;
  context.lineWidth = 2;
  context.stroke();

  context.globalAlpha = 0.16;
  context.fillStyle = palette.paperShade;
  for (let index = 0; index < 34; index += 1) {
    const x = 10 + ((index * 73) % 340);
    const y = 9 + ((index * 47) % 311);
    context.fillRect(x, y, index % 3 === 0 ? 2 : 1, 1);
  }
  context.restore();
}

function drawSky(
  context: CanvasRenderingContext2D,
  palette: CanvasPalette,
  elapsedSeconds: number,
  motionScale: number,
): void {
  const skyGradient = context.createLinearGradient(0, 35, 0, 284);
  skyGradient.addColorStop(0, palette.skyTop);
  skyGradient.addColorStop(1, palette.skyBottom);
  context.fillStyle = skyGradient;
  context.fillRect(18, 27, 324, 260);

  for (const star of STAR_POINTS) {
    const twinkle =
      0.72 +
      Math.sin(elapsedSeconds * 2.2 * motionScale + star.phase) * 0.2 * motionScale;
    context.save();
    context.globalAlpha = clamp(twinkle, 0.45, 0.94);
    context.fillStyle = star.size > 1.5 ? palette.star : palette.paperLight;
    if (star.size > 1.65) {
      drawStar(context, star.x, star.y, star.size * 2, star.size * 0.78);
      context.fill();
    } else {
      context.beginPath();
      context.arc(star.x, star.y, star.size, 0, Math.PI * 2);
      context.fill();
    }
    context.restore();
  }

  drawCloud(context, 55, 239, 1.15, palette);
  drawCloud(context, 292, 232, 1.04, palette);
  drawCloud(context, 157, 257, 0.82, palette);
}

function drawCurtains(
  context: CanvasRenderingContext2D,
  palette: CanvasPalette,
): void {
  context.save();
  context.fillStyle = palette.navy;
  context.strokeStyle = palette.brass;
  context.lineWidth = 2;

  context.beginPath();
  context.moveTo(18, 28);
  context.lineTo(342, 28);
  context.lineTo(342, 45);
  context.bezierCurveTo(315, 62, 287, 63, 260, 43);
  context.bezierCurveTo(232, 62, 205, 64, 180, 43);
  context.bezierCurveTo(155, 64, 128, 62, 100, 43);
  context.bezierCurveTo(73, 63, 45, 62, 18, 45);
  context.closePath();
  context.fill();
  context.stroke();

  context.fillStyle = palette.navyDeep;
  context.beginPath();
  context.moveTo(22, 43);
  context.bezierCurveTo(31, 64, 37, 113, 35, 169);
  context.bezierCurveTo(33, 218, 27, 255, 21, 280);
  context.lineTo(71, 280);
  context.bezierCurveTo(61, 223, 66, 160, 74, 109);
  context.bezierCurveTo(79, 75, 72, 54, 62, 43);
  context.closePath();
  context.fill();
  context.stroke();

  context.beginPath();
  context.moveTo(338, 43);
  context.bezierCurveTo(329, 64, 323, 113, 325, 169);
  context.bezierCurveTo(327, 218, 333, 255, 339, 280);
  context.lineTo(289, 280);
  context.bezierCurveTo(299, 223, 294, 160, 286, 109);
  context.bezierCurveTo(281, 75, 288, 54, 298, 43);
  context.closePath();
  context.fill();
  context.stroke();

  context.globalAlpha = 0.35;
  context.strokeStyle = palette.paperLight;
  context.lineWidth = 1;
  for (const x of [36, 49, 62, 298, 311, 324]) {
    context.beginPath();
    context.moveTo(x, 54);
    context.quadraticCurveTo(x + (x < 180 ? 5 : -5), 150, x, 264);
    context.stroke();
  }
  context.restore();
}

function drawPlatform(
  context: CanvasRenderingContext2D,
  palette: CanvasPalette,
  launchProgress: number,
): void {
  context.save();
  context.globalAlpha = 0.25 * (1 - launchProgress * 0.72);
  context.fillStyle = palette.shadow;
  context.beginPath();
  context.ellipse(180, 271, 88 - launchProgress * 24, 17 - launchProgress * 5, 0, 0, Math.PI * 2);
  context.fill();
  context.restore();

  context.save();
  context.shadowColor = palette.shadow;
  context.shadowBlur = 6;
  context.shadowOffsetY = 3;
  context.fillStyle = palette.purpleDeep;
  context.beginPath();
  context.ellipse(180, 276, 145, 31, 0, 0, Math.PI * 2);
  context.fill();
  context.shadowBlur = 0;
  context.strokeStyle = palette.brass;
  context.lineWidth = 2;
  context.stroke();

  context.fillStyle = palette.purple;
  context.beginPath();
  context.ellipse(180, 270, 122, 25, 0, 0, Math.PI * 2);
  context.fill();
  context.strokeStyle = palette.brassLight;
  context.lineWidth = 1.5;
  context.stroke();

  context.fillStyle = palette.paperShade;
  context.beginPath();
  context.ellipse(180, 266, 91, 18, 0, 0, Math.PI * 2);
  context.fill();
  context.strokeStyle = palette.brass;
  context.stroke();

  context.fillStyle = palette.purpleDeep;
  context.beginPath();
  context.ellipse(180, 264, 68, 13, 0, 0, Math.PI * 2);
  context.fill();
  context.restore();
}

function drawMusicNote(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  palette: CanvasPalette,
): void {
  context.save();
  context.strokeStyle = palette.ink;
  context.fillStyle = palette.ink;
  context.lineWidth = 2.6;
  context.lineCap = "round";
  context.beginPath();
  context.moveTo(x + 4, y - 9);
  context.lineTo(x + 4, y + 5);
  context.stroke();
  context.beginPath();
  context.moveTo(x + 4, y - 9);
  context.quadraticCurveTo(x + 10, y - 8, x + 11, y - 3);
  context.stroke();
  context.beginPath();
  context.ellipse(x, y + 7, 5.5, 4, -0.32, 0, Math.PI * 2);
  context.fill();
  context.restore();
}

function drawFlame(
  context: CanvasRenderingContext2D,
  x: number,
  baseY: number,
  length: number,
  palette: CanvasPalette,
): void {
  context.save();
  context.shadowColor = palette.flame;
  context.shadowBlur = 13;
  context.fillStyle = palette.flame;
  context.globalAlpha = 0.84;
  context.beginPath();
  context.moveTo(x - 10, baseY - 1);
  context.bezierCurveTo(
    x - 12,
    baseY + length * 0.35,
    x - 5,
    baseY + length * 0.8,
    x,
    baseY + length,
  );
  context.bezierCurveTo(
    x + 5,
    baseY + length * 0.8,
    x + 12,
    baseY + length * 0.35,
    x + 10,
    baseY - 1,
  );
  context.closePath();
  context.fill();

  context.shadowBlur = 5;
  context.fillStyle = palette.flameHot;
  context.globalAlpha = 0.95;
  context.beginPath();
  context.moveTo(x - 5, baseY);
  context.quadraticCurveTo(x - 5, baseY + length * 0.48, x, baseY + length * 0.72);
  context.quadraticCurveTo(x + 5, baseY + length * 0.48, x + 5, baseY);
  context.closePath();
  context.fill();
  context.restore();
}

function drawRocket(
  context: CanvasRenderingContext2D,
  x: number,
  baseY: number,
  flameLength: number,
  palette: CanvasPalette,
): void {
  drawFlame(context, x, baseY + 4, flameLength, palette);

  context.save();
  context.shadowColor = palette.shadow;
  context.shadowBlur = 7;
  context.shadowOffsetY = 3;

  context.fillStyle = palette.purple;
  context.strokeStyle = palette.brass;
  context.lineWidth = 2;
  context.beginPath();
  context.moveTo(x - 22, baseY - 47);
  context.bezierCurveTo(x - 40, baseY - 38, x - 52, baseY - 13, x - 49, baseY + 8);
  context.quadraticCurveTo(x - 34, baseY - 1, x - 18, baseY - 9);
  context.closePath();
  context.fill();
  context.stroke();

  context.beginPath();
  context.moveTo(x + 22, baseY - 47);
  context.bezierCurveTo(x + 40, baseY - 38, x + 52, baseY - 13, x + 49, baseY + 8);
  context.quadraticCurveTo(x + 34, baseY - 1, x + 18, baseY - 9);
  context.closePath();
  context.fill();
  context.stroke();

  context.shadowBlur = 0;
  const bodyGradient = context.createLinearGradient(x - 31, 0, x + 31, 0);
  bodyGradient.addColorStop(0, palette.paperShade);
  bodyGradient.addColorStop(0.42, palette.paperLight);
  bodyGradient.addColorStop(1, palette.paper);
  context.fillStyle = bodyGradient;
  context.strokeStyle = palette.brass;
  context.lineWidth = 2;
  context.beginPath();
  context.moveTo(x - 22, baseY - 89);
  context.quadraticCurveTo(x - 31, baseY - 64, x - 30, baseY - 29);
  context.quadraticCurveTo(x - 29, baseY - 11, x - 21, baseY - 3);
  context.lineTo(x + 21, baseY - 3);
  context.quadraticCurveTo(x + 29, baseY - 11, x + 30, baseY - 29);
  context.quadraticCurveTo(x + 31, baseY - 64, x + 22, baseY - 89);
  context.closePath();
  context.fill();
  context.stroke();

  context.fillStyle = palette.purple;
  context.beginPath();
  context.moveTo(x, baseY - 115);
  context.quadraticCurveTo(x - 15, baseY - 104, x - 22, baseY - 89);
  context.lineTo(x + 22, baseY - 89);
  context.quadraticCurveTo(x + 15, baseY - 104, x, baseY - 115);
  context.closePath();
  context.fill();
  context.stroke();

  context.fillStyle = palette.brassLight;
  context.beginPath();
  context.moveTo(x, baseY - 118);
  context.lineTo(x - 3.5, baseY - 113);
  context.lineTo(x + 3.5, baseY - 113);
  context.closePath();
  context.fill();

  roundedRectPath(context, x - 25, baseY - 94, 50, 9, 4);
  context.fillStyle = palette.brass;
  context.fill();
  context.strokeStyle = palette.brassLight;
  context.lineWidth = 1;
  context.stroke();
  context.fillStyle = palette.brassLight;
  for (const rivetX of [-17, -6, 6, 17]) {
    context.beginPath();
    context.arc(x + rivetX, baseY - 89.5, 1.7, 0, Math.PI * 2);
    context.fill();
  }

  context.fillStyle = palette.brass;
  context.beginPath();
  context.arc(x, baseY - 61, 17, 0, Math.PI * 2);
  context.fill();
  context.strokeStyle = palette.brassLight;
  context.lineWidth = 1.4;
  context.stroke();
  context.fillStyle = palette.teal;
  context.beginPath();
  context.arc(x, baseY - 61, 12.2, 0, Math.PI * 2);
  context.fill();
  context.strokeStyle = palette.navyDeep;
  context.lineWidth = 1.3;
  context.stroke();
  context.save();
  context.globalAlpha = 0.62;
  context.fillStyle = palette.paperLight;
  context.beginPath();
  context.ellipse(x - 4, baseY - 66, 4, 2.3, -0.65, 0, Math.PI * 2);
  context.fill();
  context.restore();

  context.fillStyle = palette.brass;
  context.beginPath();
  context.arc(x, baseY - 31, 10.5, 0, Math.PI * 2);
  context.fill();
  context.strokeStyle = palette.brassLight;
  context.lineWidth = 1;
  context.stroke();
  drawMusicNote(context, x - 1, baseY - 32, palette);

  roundedRectPath(context, x - 28, baseY - 13, 56, 12, 5);
  context.fillStyle = palette.purpleDeep;
  context.fill();
  context.strokeStyle = palette.brass;
  context.lineWidth = 2;
  context.stroke();
  context.fillStyle = palette.brassLight;
  for (const rivetX of [-19, -7, 7, 19]) {
    context.beginPath();
    context.arc(x + rivetX, baseY - 7, 2, 0, Math.PI * 2);
    context.fill();
  }

  roundedRectPath(context, x - 15, baseY - 2, 30, 8, 3);
  context.fillStyle = palette.brass;
  context.fill();
  context.strokeStyle = palette.brassLight;
  context.lineWidth = 1;
  context.stroke();
  context.restore();
}

function drawStageFrame(
  context: CanvasRenderingContext2D,
  palette: CanvasPalette,
): void {
  context.save();
  stageOpeningPath(context);
  context.strokeStyle = palette.paperShade;
  context.lineWidth = 15;
  context.stroke();
  stageOpeningPath(context);
  context.strokeStyle = palette.brass;
  context.lineWidth = 2.5;
  context.stroke();
  stageOpeningPath(context);
  context.strokeStyle = palette.paperLight;
  context.globalAlpha = 0.72;
  context.lineWidth = 1;
  context.stroke();
  context.globalAlpha = 1;

  for (const x of [12, 330]) {
    roundedRectPath(context, x, 61, 18, 225, 5);
    const columnGradient = context.createLinearGradient(x, 0, x + 18, 0);
    columnGradient.addColorStop(0, palette.paperShade);
    columnGradient.addColorStop(0.45, palette.paperLight);
    columnGradient.addColorStop(1, palette.paper);
    context.fillStyle = columnGradient;
    context.fill();
    context.strokeStyle = palette.brass;
    context.lineWidth = 1.5;
    context.stroke();

    roundedRectPath(context, x - 3, 59, 24, 9, 3);
    context.fillStyle = palette.brass;
    context.fill();
    roundedRectPath(context, x - 4, 280, 26, 10, 3);
    context.fill();
  }

  context.shadowColor = palette.shadow;
  context.shadowBlur = 5;
  context.fillStyle = palette.brass;
  context.beginPath();
  context.arc(180, 25, 16, 0, Math.PI * 2);
  context.fill();
  context.shadowBlur = 0;
  context.fillStyle = palette.navyDeep;
  context.beginPath();
  context.arc(180, 25, 11.5, 0, Math.PI * 2);
  context.fill();
  context.fillStyle = palette.star;
  drawStar(context, 180, 25, 8.2, 3.5);
  context.fill();
  context.restore();
}

function drawBeatRail(
  context: CanvasRenderingContext2D,
  palette: CanvasPalette,
  pattern: readonly Subdivision[],
  currentBeat: number,
  filledCount: number,
  phase: GamePhase,
): void {
  const beats = pattern.slice(0, 4);
  const displayBeats: readonly Subdivision[] =
    beats.length > 0 ? beats : ([1, 1, 1, 1] as const);

  context.save();
  context.shadowColor = palette.shadow;
  context.shadowBlur = 5;
  context.shadowOffsetY = 2;
  roundedRectPath(context, 35, 294, 290, 29, 12);
  context.fillStyle = palette.paper;
  context.fill();
  context.shadowBlur = 0;
  context.strokeStyle = palette.brass;
  context.lineWidth = 1.5;
  context.stroke();

  roundedRectPath(context, 45, 300, 270, 17, 7);
  context.fillStyle = palette.navyDeep;
  context.fill();

  const railX = 50;
  const railY = 303;
  const railWidth = 260;
  const railHeight = 11;
  const beatGap = 4;
  const beatWidth =
    (railWidth - beatGap * Math.max(0, displayBeats.length - 1)) /
    displayBeats.length;

  displayBeats.forEach((subdivision, beatIndex) => {
    const beatX = railX + beatIndex * (beatWidth + beatGap);
    const isCurrent = beatIndex === currentBeat;
    const cellsFilled =
      phase === "complete" || beatIndex < currentBeat
        ? subdivision
        : isCurrent
          ? clamp(Math.floor(filledCount), 0, subdivision)
          : 0;
    const cellGap = 1.3;
    const cellWidth =
      (beatWidth - cellGap * Math.max(0, subdivision - 1)) / subdivision;

    if (isCurrent) {
      context.save();
      context.shadowColor = palette.mint;
      context.shadowBlur = 7;
      roundedRectPath(context, beatX - 1.5, railY - 1.5, beatWidth + 3, railHeight + 3, 4);
      context.strokeStyle = palette.brassLight;
      context.lineWidth = 1.2;
      context.stroke();
      context.restore();
    }

    for (let cell = 0; cell < subdivision; cell += 1) {
      const cellX = beatX + cell * (cellWidth + cellGap);
      roundedRectPath(context, cellX, railY, cellWidth, railHeight, 2.5);
      context.fillStyle =
        cell < cellsFilled ? (isCurrent ? palette.mint : palette.teal) : palette.paperShade;
      context.fill();
      context.globalAlpha = cell < cellsFilled ? 0.9 : 0.42;
      context.strokeStyle = cell < cellsFilled ? palette.paperLight : palette.brass;
      context.lineWidth = 0.8;
      context.stroke();
      context.globalAlpha = 1;
    }
  });

  context.restore();
}

function createParticlePool(): Particle[] {
  return Array.from({ length: PARTICLE_POOL_SIZE }, () => ({
    active: false,
    kind: "spark" as const,
    tone: "star" as const,
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    gravity: 0,
    age: 0,
    life: 0,
    size: 0,
    rotation: 0,
    spin: 0,
  }));
}

function particleColor(particle: Particle, palette: CanvasPalette): string {
  return palette[particle.tone];
}

function drawParticles(
  context: CanvasRenderingContext2D,
  particles: readonly Particle[],
  palette: CanvasPalette,
): void {
  for (const particle of particles) {
    if (!particle.active) continue;
    const remaining = clamp(1 - particle.age / particle.life, 0, 1);
    context.save();
    context.globalAlpha = remaining * (particle.kind === "smoke" ? 0.48 : 0.9);
    context.fillStyle = particleColor(particle, palette);
    context.translate(particle.x, particle.y);
    context.rotate(particle.rotation);

    if (particle.kind === "spark") {
      drawStar(context, 0, 0, particle.size, particle.size * 0.42);
      context.fill();
    } else if (particle.kind === "exhaust") {
      context.beginPath();
      context.ellipse(0, 0, particle.size * 0.72, particle.size, 0, 0, Math.PI * 2);
      context.fill();
    } else {
      context.beginPath();
      context.arc(0, 0, particle.size * (1.2 - remaining * 0.2), 0, Math.PI * 2);
      context.fill();
    }
    context.restore();
  }
}

function updateParticles(particles: readonly Particle[], deltaSeconds: number): void {
  for (const particle of particles) {
    if (!particle.active) continue;
    particle.age += deltaSeconds;
    if (particle.age >= particle.life) {
      particle.active = false;
      continue;
    }
    particle.x += particle.vx * deltaSeconds;
    particle.y += particle.vy * deltaSeconds;
    particle.vy += particle.gravity * deltaSeconds;
    particle.rotation += particle.spin * deltaSeconds;
  }
}

function safeAudioTime(getAudioTime: () => number): number {
  try {
    const time = getAudioTime();
    return Number.isFinite(time) ? time : 0;
  } catch {
    return 0;
  }
}

function getLaunchProgress(
  phase: GamePhase,
  schedule: RunSchedule | null,
  audioTime: number,
  motion: MotionMode,
): number {
  if (phase !== "complete" || !schedule) return 0;
  const duration = Math.max(0.7, schedule.secondsPerBeat * 1.45);
  const progress = clamp((audioTime - schedule.playEnd) / duration, 0, 1);
  return motion === "minimal" ? (progress > 0 ? 1 : 0) : progress;
}

export function RocketCanvas({
  phase,
  schedule,
  pattern,
  currentBeat,
  filledCount,
  judgement,
  pulseKey,
  motion,
  getAudioTime,
}: RocketCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const propsRef = useRef<RocketCanvasProps>({
    phase,
    schedule,
    pattern,
    currentBeat,
    filledCount,
    judgement,
    pulseKey,
    motion,
    getAudioTime,
  });

  useEffect(() => {
    propsRef.current = {
      phase,
      schedule,
      pattern,
      currentBeat,
      filledCount,
      judgement,
      pulseKey,
      motion,
      getAudioTime,
    };
  }, [
    currentBeat,
    filledCount,
    getAudioTime,
    judgement,
    motion,
    pattern,
    phase,
    pulseKey,
    schedule,
  ]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext("2d");
    if (!context) return;

    let disposed = false;
    let frameId = 0;
    let deviceScale = 1;
    let lastFrameTime = performance.now();
    let lastPulseKey = propsRef.current.pulseKey;
    let pulseStartedAt = Number.NEGATIVE_INFINITY;
    let pulseJudgement: Judgement | null = null;
    let missStartedAt = Number.NEGATIVE_INFINITY;
    let lastExhaustAt = Number.NEGATIVE_INFINITY;
    let emissionIndex = 0;
    let palette = readPalette(canvas);
    const particles = createParticlePool();

    const resizeCanvas = (): void => {
      deviceScale = Math.min(Math.max(window.devicePixelRatio || 1, 1), 2);
      const targetWidth = Math.round(LOGICAL_WIDTH * deviceScale);
      const targetHeight = Math.round(LOGICAL_HEIGHT * deviceScale);
      if (canvas.width !== targetWidth || canvas.height !== targetHeight) {
        canvas.width = targetWidth;
        canvas.height = targetHeight;
      }
      palette = readPalette(canvas);
    };

    const acquireParticle = (): Particle | null =>
      particles.find((particle) => !particle.active) ?? null;

    const emitParticle = (
      kind: ParticleKind,
      tone: ParticleTone,
      x: number,
      y: number,
      vx: number,
      vy: number,
      gravity: number,
      life: number,
      size: number,
      spin: number,
    ): void => {
      const particle = acquireParticle();
      if (!particle) return;
      particle.active = true;
      particle.kind = kind;
      particle.tone = tone;
      particle.x = x;
      particle.y = y;
      particle.vx = vx;
      particle.vy = vy;
      particle.gravity = gravity;
      particle.age = 0;
      particle.life = life;
      particle.size = size;
      particle.rotation = ((emissionIndex * 37) % 360) * (Math.PI / 180);
      particle.spin = spin;
      emissionIndex += 1;
    };

    const emitJudgementBurst = (
      result: Judgement,
      x: number,
      y: number,
      motionMode: MotionMode,
    ): void => {
      if (motionMode === "minimal") return;
      const count = result === "Perfect" ? 6 : result === "Good" ? 4 : 2;
      const tone: ParticleTone =
        result === "Perfect" ? "mint" : result === "Good" ? "star" : "miss";
      const kind: ParticleKind = result === "Miss" ? "smoke" : "spark";
      const reducedFactor = motionMode === "reduced" ? 0.65 : 1;

      for (let index = 0; index < count; index += 1) {
        const angle = ((emissionIndex * 137.5 + index * 29) % 360) * (Math.PI / 180);
        const speed = (result === "Miss" ? 16 : 34 + (index % 3) * 6) * reducedFactor;
        emitParticle(
          kind,
          tone,
          x,
          y,
          Math.cos(angle) * speed,
          Math.sin(angle) * speed - (result === "Miss" ? 7 : 10),
          result === "Miss" ? -3 : 22,
          result === "Miss" ? 0.46 : 0.62,
          result === "Perfect" ? 3.5 : 2.8,
          index % 2 === 0 ? 2.2 : -2.2,
        );
      }
    };

    const emitExhaust = (x: number, y: number, motionMode: MotionMode): void => {
      if (motionMode === "minimal") return;
      const spread = ((emissionIndex % 5) - 2) * 1.2;
      emitParticle(
        "exhaust",
        emissionIndex % 3 === 0 ? "star" : "flame",
        x + spread,
        y,
        spread * 2.4,
        28 + (emissionIndex % 4) * 4,
        18,
        motionMode === "reduced" ? 0.38 : 0.55,
        motionMode === "reduced" ? 2.2 : 3,
        spread * 0.3,
      );
    };

    const render = (frameTime: number): void => {
      if (disposed) return;
      const deltaSeconds = Math.min((frameTime - lastFrameTime) / 1000, 0.05);
      lastFrameTime = frameTime;
      const current = propsRef.current;
      const elapsedSeconds = frameTime / 1000;
      const audioTime = safeAudioTime(current.getAudioTime);
      const launchProgress = getLaunchProgress(
        current.phase,
        current.schedule,
        audioTime,
        current.motion,
      );
      const easedLaunch = easeOutCubic(launchProgress);
      const motionScale =
        current.motion === "full" ? 1 : current.motion === "reduced" ? 0.32 : 0;
      const idleBob =
        current.phase === "paused"
          ? 0
          : Math.sin(elapsedSeconds * 2.05) * 2.1 * motionScale * (1 - launchProgress);
      const rocketBaseY = 246 + idleBob - easedLaunch * 118;

      if (current.pulseKey !== lastPulseKey) {
        lastPulseKey = current.pulseKey;
        pulseStartedAt = frameTime;
        pulseJudgement = current.judgement;
        if (current.judgement) {
          emitJudgementBurst(current.judgement, 180, rocketBaseY - 54, current.motion);
          if (current.judgement === "Miss" && current.motion === "full") {
            missStartedAt = frameTime;
          }
        }
      }

      const missAge = frameTime - missStartedAt;
      const missShake =
        current.motion === "full" && missAge >= 0 && missAge < 230
          ? Math.sin(missAge * 0.12) * 4.2 * (1 - missAge / 230)
          : 0;
      const rocketX = 180 + missShake;

      if (
        launchProgress > 0 &&
        launchProgress < 1 &&
        current.motion !== "minimal" &&
        frameTime - lastExhaustAt > (current.motion === "reduced" ? 125 : 72)
      ) {
        emitExhaust(rocketX, rocketBaseY + 28, current.motion);
        lastExhaustAt = frameTime;
      }

      updateParticles(particles, deltaSeconds);

      context.setTransform(deviceScale, 0, 0, deviceScale, 0, 0);
      context.clearRect(0, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT);
      context.lineJoin = "round";
      context.lineCap = "round";
      drawPaperFrame(context, palette);

      context.save();
      stageOpeningPath(context);
      context.clip();
      drawSky(context, palette, elapsedSeconds, motionScale);
      drawPlatform(context, palette, launchProgress);

      const pulseAge = (frameTime - pulseStartedAt) / 420;
      if (pulseJudgement && pulseAge >= 0 && pulseAge < 1) {
        context.save();
        context.globalAlpha = (1 - pulseAge) * 0.34;
        context.strokeStyle =
          pulseJudgement === "Perfect"
            ? palette.mint
            : pulseJudgement === "Good"
              ? palette.brassLight
              : palette.miss;
        context.lineWidth = 4 - pulseAge * 2;
        context.shadowColor = context.strokeStyle;
        context.shadowBlur = 12;
        context.beginPath();
        context.ellipse(
          rocketX,
          rocketBaseY - 53,
          33 + pulseAge * 25,
          46 + pulseAge * 22,
          0,
          0,
          Math.PI * 2,
        );
        context.stroke();
        context.restore();
      }

      drawParticles(context, particles, palette);
      const flicker = Math.sin(elapsedSeconds * 14) * 2.2 * motionScale;
      const flameLength = 20 + launchProgress * 32 + flicker;
      drawRocket(context, rocketX, rocketBaseY, flameLength, palette);
      drawCurtains(context, palette);
      context.restore();

      drawStageFrame(context, palette);
      drawBeatRail(
        context,
        palette,
        current.pattern,
        current.currentBeat,
        current.filledCount,
        current.phase,
      );

      frameId = requestAnimationFrame(render);
    };

    resizeCanvas();
    window.addEventListener("resize", resizeCanvas);

    const styleObserver = new MutationObserver(() => {
      palette = readPalette(canvas);
    });
    styleObserver.observe(canvas, {
      attributes: true,
      attributeFilter: ["class", "style"],
    });
    styleObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class", "style"],
    });
    if (document.body) {
      styleObserver.observe(document.body, {
        attributes: true,
        attributeFilter: ["class", "style"],
      });
    }

    frameId = requestAnimationFrame(render);

    return () => {
      disposed = true;
      cancelAnimationFrame(frameId);
      window.removeEventListener("resize", resizeCanvas);
      styleObserver.disconnect();
      for (const particle of particles) particle.active = false;
    };
  }, []);

  const activeSubdivision = pattern[currentBeat];
  const progressLabel = activeSubdivision
    ? `${currentBeat + 1}번째 박, ${activeSubdivision}분할 중 ${clamp(
        Math.floor(filledCount),
        0,
        activeSubdivision,
      )}칸 점화`
    : "발사대에서 대기 중";

  return (
    <canvas
      ref={canvasRef}
      className="rocket-canvas"
      width={LOGICAL_WIDTH}
      height={LOGICAL_HEIGHT}
      role="img"
      aria-label={`별빛 극장의 분할 로켓. ${progressLabel}`}
      style={{
        aspectRatio: `${LOGICAL_WIDTH} / ${LOGICAL_HEIGHT}`,
        display: "block",
        height: "auto",
        width: "100%",
      }}
    >
      별빛 무대 위 분할 로켓 애니메이션
    </canvas>
  );
}

export default RocketCanvas;
