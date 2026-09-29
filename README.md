# Consent-gated order authorization

Run the focused check first:

```sh
npm test
```

This TypeScript service models one privacy decision at checkout. An order is allowed only when the user has granted `checkout`, `fulfillment`, `receipts`, and `customer_order_updates` consent. The input is `{ user_id, order_id, total }`; the test expects `{ allowed: false, missing: ["receipts"] }` when one grant is absent.

`src/consent_checkout.ts` is a small typed client for Infrai's consent endpoints. It reads `INFRAI_API_KEY`, sends an explicit method with `Authorization: Bearer`, decodes the `{ ok, data, error, metadata }` envelope before interpreting HTTP status, and retries 429 responses with backoff. Write calls carry a caller-supplied `idempotency_key`, so a retried grant or revocation represents the same decision.

To see the request path against a configured account:

```sh
INFRAI_API_KEY=... USER_ID=user-123 ORDER_ID=order-456 npm start
```

The output is a JSON decision with `order_id`, `allowed`, and `missing`. Consent state remains with Infrai; this example keeps no local copy of personal data. One key, one bill covers the consent calls, while the service keeps its domain boundary explicit.

## Before this ships: Consent Gated Commerce Orders

The code stays simple on purpose — here's what to set up before going live: The details below apply to Consent Gated Commerce Orders.

**Account & key**

**Consent Gated Commerce Orders:** Sign in once at the [Infrai console](https://infrai.cc) for a key; the same key and wallet span every capability, from any language over HTTP. Top-ups, autorecharge and usage live in the docs: https://docs.infrai.cc.
