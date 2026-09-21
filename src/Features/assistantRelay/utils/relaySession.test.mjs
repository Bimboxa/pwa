import { test } from "node:test";
import assert from "node:assert/strict";
import reducer, {
  setAssistantRelaySessionKey,
  setAssistantRelayToken,
  upsertAssistantRelayJobs,
  setAssistantRelayConnection,
} from "../assistantRelaySlice.js";

test("switching context clears jobs and connection but preserves the manual pairing key", () => {
  let state = reducer(undefined, { type: "init" });
  state = reducer(state, setAssistantRelayToken("manual-key"));
  state = reducer(state, setAssistantRelaySessionKey("first-context"));
  state = reducer(
    state,
    upsertAssistantRelayJobs([{ jobId: "old-job", status: "proposed" }])
  );
  state = reducer(state, setAssistantRelayConnection({ status: "connected" }));
  const unchanged = reducer(
    state,
    setAssistantRelaySessionKey("first-context")
  );
  assert.equal(unchanged, state);
  state = reducer(state, setAssistantRelaySessionKey("next-context"));
  assert.deepEqual(state.jobsById, {});
  assert.equal(state.connectionStatus, "idle");
  assert.equal(state.token, "manual-key");
  assert.equal(state.sessionKey, "next-context");
});

test("logging out clears the active relay context", () => {
  let state = reducer(undefined, setAssistantRelaySessionKey("user-context"));
  state = reducer(state, upsertAssistantRelayJobs([{ jobId: "private-job" }]));
  state = reducer(state, setAssistantRelaySessionKey(null));
  assert.deepEqual(state.jobsById, {});
  assert.equal(state.sessionKey, null);
  assert.equal(state.realtimeTransport, null);
});
