import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request("http://localhost/", {
      headers: { accept: "text/html" },
    }),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );
}

test("server-renders the Korean game shell and product metadata", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<html lang="ko"/i);
  assert.match(html, /<title>분할 로켓 \| 멜로디아 리듬 실험실<\/title>/i);
  assert.match(html, /별빛 발사대를 준비하고 있어요/);
  assert.match(html, /aria-label="분할 로켓 준비 중"/);
  assert.doesNotMatch(html, /codex-preview|Your site is taking shape|react-loading-skeleton/i);
});

test("keeps game timing, Canvas, and UI styling in separate modules", async () => {
  const [page, game, canvas, timing, css] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/game/RocketGame.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/game/components/RocketCanvas.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/game/systems/judgement.ts", import.meta.url), "utf8"),
    readFile(new URL("../src/styles/00-tokens.css", import.meta.url), "utf8"),
  ]);

  assert.match(page, /RocketGame/);
  assert.match(game, /AudioEngine/);
  assert.match(game, /localStorage|persistSave/);
  assert.match(canvas, /PARTICLE_POOL_SIZE = 16/);
  assert.match(canvas, /devicePixelRatio/);
  assert.match(timing, /expectedSubdivisionTimes/);
  assert.match(timing, /PERFECT_WINDOW_MS = 70/);
  assert.match(timing, /GOOD_WINDOW_MS = 130/);
  assert.match(css, /--theme-primary: #7257d9/);
  assert.match(css, /--theme-accent: #55d6e8/);
});
