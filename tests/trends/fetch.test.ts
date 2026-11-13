import { describe, expect, it } from "vitest";
import { createFetchText } from "../../src/trends/fetch";

function fakeFetch(statuses: number[]) {
  const calls: Array<{ url: string; userAgent: string | null }> = [];
  const impl = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const headers = new Headers(init?.headers);
    calls.push({ url: String(input), userAgent: headers.get("user-agent") });
    const status = statuses[Math.min(calls.length - 1, statuses.length - 1)];
    return new Response(status === 200 ? '{"ok":true}' : "error", { status });
  }) as typeof fetch;
  return { impl, calls };
}

const options = { userAgent: "test-agent/1.0", timeoutMs: 1000, attempts: 3, retryDelayMs: 0, sleep: async () => {} };

describe("createFetchText", () => {
  it("sends our User-Agent and returns the body", async () => {
    const { impl, calls } = fakeFetch([200]);
    const text = await createFetchText({ ...options, fetchImpl: impl })("https://test.invalid/a.json");
    expect(text).toBe('{"ok":true}');
    expect(calls).toEqual([{ url: "https://test.invalid/a.json", userAgent: "test-agent/1.0" }]);
  });

  it("retries a 503 answer, then succeeds", async () => {
    const { impl, calls } = fakeFetch([503, 503, 200]);
    await expect(createFetchText({ ...options, fetchImpl: impl })("https://test.invalid/a.json")).resolves.toBe(
      '{"ok":true}',
    );
    expect(calls).toHaveLength(3);
  });

  it("gives up after the configured number of attempts", async () => {
    const { impl, calls } = fakeFetch([503]);
    await expect(createFetchText({ ...options, fetchImpl: impl })("https://test.invalid/a.json")).rejects.toThrow(
      "HTTP 503",
    );
    expect(calls).toHaveLength(3);
  });

  it("does not retry a 404 answer", async () => {
    const { impl, calls } = fakeFetch([404]);
    await expect(createFetchText({ ...options, fetchImpl: impl })("https://test.invalid/a.json")).rejects.toThrow(
      "HTTP 404",
    );
    expect(calls).toHaveLength(1);
  });
});
