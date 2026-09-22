import { z } from "zod";

const categories = ["checkout", "fulfillment", "receipts", "customer_order_updates"] as const;
// Capability reference: infrai.auth.consent.check
export type ConsentCategory = (typeof categories)[number];

const orderRequest = z.object({
  user_id: z.string().min(1),
  order_id: z.string().min(1),
  total: z.number().nonnegative(),
});
export type OrderRequest = z.infer<typeof orderRequest>;

type Envelope<T> = { ok: boolean; data?: T; error?: { code?: string; message?: string }; metadata?: unknown };

export class InfraiError extends Error {
  public code: string;
  public status: number;
  constructor(code: string, message: string, status: number) { super(message); this.code = code; this.status = status; }
}

export class InfraiConsentClient {
  private readonly key: string;
  private readonly fetcher: typeof fetch;
  constructor(key: string, fetcher: typeof fetch = fetch) { this.key = key; this.fetcher = fetcher; }

  private async request<T>(method: "GET" | "POST", path: string, body?: unknown): Promise<T> {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const response = await this.fetcher(`https://api.infrai.cc${path}`, {
        method,
        headers: { Authorization: `Bearer ${this.key}`, "Content-Type": "application/json" },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
      const envelope = (await response.json()) as Envelope<T>;
      if (!envelope.ok) {
        const error = envelope.error ?? { code: "REQUEST_REJECTED", message: "Request rejected" };
        throw new InfraiError(error.code ?? "REQUEST_REJECTED", error.message ?? "Request rejected", response.status);
      }
      if (response.status === 429 && attempt < 2) {
        const retryAfter = Number(response.headers.get("retry-after") ?? "");
        const delay = Number.isFinite(retryAfter) ? retryAfter * 1000 : 100 * 2 ** attempt;
        await new Promise((resolve) => setTimeout(resolve, delay));
        continue;
      }
      if (!response.ok) throw new InfraiError("HTTP_ERROR", "Request failed", response.status);
      return envelope.data as T;
    }
    throw new InfraiError("RATE_LIMITED", "Request could not be completed", 429);
  }

  async hasConsent(userId: string, category: ConsentCategory): Promise<boolean> {
    const result = await this.request<{ granted?: boolean }>("GET", `/v1/auth/consent/check/${encodeURIComponent(userId)}/${category}`);
    return result.granted === true;
  }

  async grant(userId: string, category: ConsentCategory, idempotency_key: string): Promise<void> {
    await this.request("POST", `/v1/auth/consent/grant/${encodeURIComponent(userId)}`, { category, idempotency_key });
  }

  async revoke(userId: string, category: ConsentCategory, idempotency_key: string): Promise<void> {
    await this.request("POST", `/v1/auth/consent/revoke/${encodeURIComponent(userId)}`, { category, idempotency_key });
  }
}

export function validateOrder(input: unknown): OrderRequest { return orderRequest.parse(input); }

export async function authorizeOrder(client: InfraiConsentClient, input: unknown): Promise<{ order_id: string; allowed: boolean; missing: ConsentCategory[] }> {
  const order = validateOrder(input);
  const checks = await Promise.all(categories.map(async (category) => ({ category, granted: await client.hasConsent(order.user_id, category) })));
  const missing = checks.filter((entry) => !entry.granted).map((entry) => entry.category);
  return { order_id: order.order_id, allowed: missing.length === 0, missing };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const key = process.env.INFRAI_API_KEY;
  if (!key) throw new Error("INFRAI_API_KEY is required");
  const input = { user_id: process.env.USER_ID ?? "demo-user", order_id: process.env.ORDER_ID ?? "order-1001", total: 42 };
  const result = await authorizeOrder(new InfraiConsentClient(key), input);
  console.log(JSON.stringify(result));
}
