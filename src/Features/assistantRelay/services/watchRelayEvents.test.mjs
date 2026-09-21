import { test } from "node:test";
import assert from "node:assert/strict";
import { setTimeout as delay } from "node:timers/promises";
import { watchRelayEvents } from "./watchRelayEvents.js";

test("reconnects, refreshes on ready/change and stops on unmount", async () => {
  let connections = 0,
    refreshes = 0;
  const statuses = [];
  const stop = watchRelayEvents({
    retryMs: 5,
    pollMs: 10,
    idleMs: 1000,
    refresh: async () => {
      refreshes++;
    },
    onStatus: (s) => statuses.push(s),
    stream: async ({ signal, onEvent }) => {
      connections++;
      onEvent({ type: "ready" });
      onEvent({ type: "change" });
      if (connections === 1) throw new Error("Disconnected");
      await new Promise((resolve) =>
        signal.addEventListener("abort", resolve, { once: true })
      );
    },
  });
  try {
    for (let i = 0; i < 50 && connections < 2; i++) await delay(5);
    assert.equal(connections, 2);
    assert.ok(refreshes >= 2);
    assert.ok(statuses.includes("subscribed"));
  } finally {
    stop();
  }
  const before = connections;
  await delay(25);
  assert.equal(connections, before);
  assert.equal(statuses.at(-1), "idle");
});

test("falls back to periodic refresh and aborts a stalled stream", async () => {
  let aborts = 0,
    refreshes = 0;
  const stop = watchRelayEvents({
    retryMs: 5,
    pollMs: 5,
    idleMs: 15,
    refresh: async () => {
      refreshes++;
    },
    onStatus: () => {},
    stream: async ({ signal }) =>
      new Promise((resolve) =>
        signal.addEventListener(
          "abort",
          () => {
            aborts++;
            resolve();
          },
          { once: true }
        )
      ),
  });
  try {
    for (let i = 0; i < 50 && !aborts; i++) await delay(5);
    assert.ok(aborts > 0);
    assert.ok(refreshes > 0);
  } finally {
    stop();
  }
});
