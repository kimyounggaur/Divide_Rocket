import assert from "node:assert/strict";
import test from "node:test";
import {
  evaluateBeat,
  expectedSubdivisionTimes,
} from "./judgement.ts";

test("creates different 1, 2, 3, and 4 subdivision grids", () => {
  assert.deepEqual(expectedSubdivisionTimes(10, 1, 1), [10]);
  assert.deepEqual(expectedSubdivisionTimes(10, 1, 2), [10, 10.5]);
  assert.deepEqual(expectedSubdivisionTimes(10, 1, 3), [
    10,
    10 + 1 / 3,
    10 + 2 / 3,
  ]);
  assert.deepEqual(expectedSubdivisionTimes(10, 1, 4), [10, 10.25, 10.5, 10.75]);
});

test("does not award Perfect for an uneven four-note input", () => {
  const result = evaluateBeat(0, 0, 1, 4, [0, 0.18, 0.55, 0.75]);
  assert.notEqual(result.judgement, "Perfect");
  assert.equal(result.error, "uneven");
});

test("separates extra and missing input feedback", () => {
  assert.equal(evaluateBeat(0, 0, 1, 3, [0, 1 / 3]).error, "missing");
  assert.equal(evaluateBeat(0, 0, 1, 2, [0, 0.5, 0.7]).error, "extra");
});
