import assert from "node:assert/strict";
import test from "node:test";
import createRuntime from "./createLocalScanRuntime.js";

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

test("one decode per resource and zone, shared until the last release", async () => {
  let decodes = 0;
  const signals = [];
  const runtime = createRuntime(
    async (resource, { signal }) => {
      decodes++;
      signals.push(signal);
      return { data: resource.id };
    },
    { evictionDelayMs: 5 }
  );
  const resource = { id: "a", scan: { zone: { zMin: 0 } } };
  const first = runtime.acquire(resource);
  const second = runtime.acquire({ ...resource });
  assert.equal(first.promise, second.promise);
  assert.deepEqual(await first.promise, { data: "a" });
  assert.equal(decodes, 1);
  // Another zone of the same resource is another decode.
  const other = runtime.acquire({ id: "a", scan: { zone: { zMin: 1 } } });
  await other.promise;
  assert.equal(decodes, 2);
  first.release();
  first.release();
  await wait(10);
  assert.ok(runtime.has(resource), "still held by the second reference");
  second.release();
  // Reacquired before the delay: kept.
  const third = runtime.acquire(resource);
  await wait(10);
  assert.equal(decodes, 2);
  third.release();
  await wait(10);
  assert.equal(runtime.has(resource), false);
  assert.equal(signals[0].aborted, true);
  other.release();
});

test("a failed decode is not cached and a seeded scan is shared", async () => {
  let fail = true;
  const runtime = createRuntime(
    async () => {
      if (fail) throw new Error("missing");
      return { data: "decoded" };
    },
    { evictionDelayMs: 5 }
  );
  const resource = { id: "b", scan: {} };
  const failed = runtime.acquire(resource);
  await assert.rejects(failed.promise, /missing/);
  failed.release();
  assert.equal(runtime.has(resource), false);
  fail = false;
  const seeded = runtime.seed(resource, { data: "seeded" });
  const shared = runtime.acquire(resource);
  assert.deepEqual(await shared.promise, { data: "seeded" });
  seeded.release();
  shared.release();
  await wait(10);
  assert.equal(runtime.has(resource), false);
});
