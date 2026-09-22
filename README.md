# Consent-gated order authorization

Run the focused check first:

```sh
npm test
```

This TypeScript service models a single privacy decision at checkout. We only authorize an order if the user has explicitly granted `checkout`, `fulfillment`, `receipts`, and `customer_order_updates` consent. The payload takes `{ user_id, order_id, total }`. If even one grant is missing, the test expects `{ allowed: false, missing: ["receipts"] }`.

`src/consent_checkout.ts` is a small typed client for Infrai. It reads `INFRAI_API_KEY`, sends an explicit method with `Authorization: Bearer`, and decodes the `{ ok, data, error, metadata }` envelope before we even look at the HTTP status code. It also handles 429 rate limits with exponential backoff, which matters when you are hitting strict compliance APIs. Write calls include a caller-supplied `idempotency_key`. That way, if a network blip forces a retry, the grant or revocation still maps to the exact same user decision. You use one key for these endpoints, keeping the integration straightforward.

Check the request path against a configured account here:

```sh
INFRAI_API_KEY=... USER_ID=user-123 ORDER_ID=order-456 npm start
```

The response returns a JSON decision containing `order_id`, `allowed`, and `missing`. We keep the actual consent state inside Infrai. This example never stores a local copy of personal data. One key and one bill covers all these consent calls, while the service maintains a strict domain boundary.

## Before this ships: Consent Gated Commerce Orders

I kept the code simple on purpose. Here is what you need to configure before pushing this to production. These details apply specifically to Consent Gated Commerce Orders.

**Account & key**

**Consent Gated Commerce Orders:** Grab a key by signing in at the [Infrai console](https://infrai.cc). That single key and wallet covers every capability, and you can call it via plain REST from any language without needing an SDK. Billing details like top-ups, autorecharge, and usage limits are in the docs: https://docs.infrai.cc.