import { createHash, timingSafeEqual } from "node:crypto";
import type { CollectOutcome } from "./collect";

/*
 * The collection address (TRD-01, ADR 0007): a timer such as a Vercel Schedule calls it to run one
 * collection, sending "Authorization: Bearer <CRON_SECRET>". Kept apart from the route so tests can
 * call it without running a real collection.
 */

export interface CollectEndpointDeps {
  /** CRON_SECRET. */
  secret: string | undefined;
  secretMinChars: number;
  run: () => Promise<CollectOutcome[]>;
  log?: (line: string) => void;
}

/**
 * True when the header is exactly "Bearer <secret>". Compares fixed-length hashes, so how long the
 * check takes says nothing about the secret.
 */
export function bearerMatches(authorization: string | null, secret: string): boolean {
  const expected = createHash("sha256").update(`Bearer ${secret}`).digest();
  const given = createHash("sha256").update(authorization ?? "").digest();
  return timingSafeEqual(expected, given);
}

function reply(body: unknown, status: number): Response {
  return Response.json(body, { status, headers: { "cache-control": "no-store" } });
}

export async function handleCollectRequest(request: Request, deps: CollectEndpointDeps): Promise<Response> {
  const log = deps.log ?? ((line: string) => console.log(line));
  const secret = deps.secret?.trim() ?? "";
  if (secret.length < deps.secretMinChars) {
    console.error(
      `[trends] CRON_SECRET is missing or shorter than ${deps.secretMinChars} characters, so the collection address is switched off.`,
    );
    return reply({ error: "The collection address is not set up." }, 503);
  }
  if (!bearerMatches(request.headers.get("authorization"), secret)) {
    return reply({ error: "Unauthorized." }, 401);
  }

  log(`[trends] collecting (called by ${request.headers.get("user-agent") ?? "an unknown client"})`);
  let outcomes: CollectOutcome[];
  try {
    outcomes = await deps.run();
  } catch (error) {
    console.error("[trends] collection failed:", error);
    return reply({ error: "The collection failed; see the server log." }, 500);
  }
  for (const outcome of outcomes) log(`[trends] ${JSON.stringify(outcome)}`);
  // A failed file answers 500, so the timer's history shows the run as failed.
  const failed = outcomes.some((outcome) => outcome.status === "rejected");
  return reply({ outcomes }, failed ? 500 : 200);
}
