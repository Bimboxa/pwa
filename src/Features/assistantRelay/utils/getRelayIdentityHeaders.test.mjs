import assert from "node:assert/strict";
import { test } from "node:test";
import getRelayIdentityHeaders from "./getRelayIdentityHeaders.js";

test("relay identity uses the master ID fallback and preserves the trigram claim spelling", () => {
  assert.deepEqual(
    getRelayIdentityHeaders({ userIdMaster: 42, trigram: "AbC" }),
    {
      "X-User-Id-Master": "42",
      "X-Trigram": "AbC",
    }
  );
  assert.deepEqual(getRelayIdentityHeaders({ idMaster: 73, trigram: "XYZ" }), {
    "X-User-Id-Master": "73",
    "X-Trigram": "XYZ",
  });
});

test("missing profile values are not sent as undefined or null identity strings", () => {
  assert.deepEqual(getRelayIdentityHeaders(undefined), {});
  assert.deepEqual(
    getRelayIdentityHeaders({ userIdMaster: null, trigram: null }),
    {}
  );
  assert.deepEqual(
    getRelayIdentityHeaders({ userIdMaster: "", trigram: "" }),
    {}
  );
});
