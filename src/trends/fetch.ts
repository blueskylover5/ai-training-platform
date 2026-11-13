export type FetchText = (url: string) => Promise<string>;

export interface FetchTextOptions {
  userAgent: string;
  timeoutMs: number;
  attempts: number;
  retryDelayMs: number;
  fetchImpl?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
}

const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * Downloads a text resource, identifying ourselves with a User-Agent.
 * Network errors, 429 and 5xx answers are retried; other 4xx answers fail at once.
 * Node's fetch requests and decodes gzip automatically.
 */
export function createFetchText(options: FetchTextOptions): FetchText {
  const doFetch = options.fetchImpl ?? fetch;
  const sleep = options.sleep ?? defaultSleep;

  return async (url) => {
    let lastError: unknown = new Error(`GET ${url} was not attempted`);
    for (let attempt = 1; attempt <= options.attempts; attempt++) {
      let retryable = true;
      try {
        const response = await doFetch(url, {
          headers: { "user-agent": options.userAgent, accept: "application/json" },
          signal: AbortSignal.timeout(options.timeoutMs),
        });
        if (response.ok) return await response.text();
        lastError = new Error(`GET ${url} answered HTTP ${response.status}`);
        retryable = response.status === 429 || response.status >= 500;
      } catch (error) {
        lastError = error;
      }
      if (!retryable) break;
      if (attempt < options.attempts) await sleep(options.retryDelayMs);
    }
    throw lastError instanceof Error ? lastError : new Error(String(lastError));
  };
}
