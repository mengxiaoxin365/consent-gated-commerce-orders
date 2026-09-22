import assert from "node:assert/strict";
import test from "node:test";
import { InfraiConsentClient, authorizeOrder } from "../src/consent_checkout.ts";

test("order is allowed only when every commerce consent is granted", async () => {
  const fetcher: typeof fetch = async (url) => {
    const category = String(url).split("/").pop();
    return new Response(JSON.stringify({ ok: true, data: { granted: category !== "receipts" } }), { status: 200, headers: { "content-type": "application/json" } });
  };
  const result = await authorizeOrder(new InfraiConsentClient("test-key", fetcher), { user_id: "u-1", order_id: "o-1", total: 10 });
  assert.deepEqual(result, { order_id: "o-1", allowed: false, missing: ["receipts"] });
});
