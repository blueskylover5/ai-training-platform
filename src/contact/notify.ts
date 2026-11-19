import { contactConfig } from "../config";
import { safeForTerminal } from "./terminal";

/*
 * Emails each stored contact message to the team through Resend (CON-03, ADR 0005). The message is
 * stored first, so an email that fails loses nothing: `npm run contact:list` still shows it.
 */

/** A contact message as stored (CON-02). */
export interface StoredContactMessage {
  id: number;
  createdAt: Date;
  name: string | null;
  email: string;
  message: string;
}

export interface EmailSettings {
  /** RESEND_API_KEY. */
  apiKey: string | undefined;
  /** Who gets the email (CONTACT_NOTIFY_TO). */
  to: string | null;
  from: string;
  apiUrl: string;
  subjectMaxChars: number;
  timeoutMs: number;
}

/** The body of Resend's "send email" request. */
export interface ContactEmail {
  from: string;
  to: string[];
  reply_to: string;
  subject: string;
  text: string;
}

export type NotifyOutcome =
  | { status: "sent"; id: string }
  /** Not set up (no API key or no recipient); nothing was sent. */
  | { status: "off" }
  | { status: "failed"; reason: string };

const sentAt = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "long",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
  timeZone: "UTC",
});

/** One line, without control characters or direction marks, cut to `max` characters. */
function oneLine(text: string, max: number): string {
  const line = safeForTerminal(text).replace(/\s+/g, " ").trim();
  return line.length > max ? `${line.slice(0, max - 1).trimEnd()}…` : line;
}

/**
 * The email for one message. Plain text only, so nothing a visitor types becomes a link or markup,
 * and control characters and direction marks are shown as U+FFFD, as `contact:list` shows them.
 * Replying goes straight to the visitor.
 */
export function contactEmail(message: StoredContactMessage, settings: Pick<EmailSettings, "from" | "subjectMaxChars"> & { to: string }): ContactEmail {
  const name = message.name ? oneLine(message.name, contactConfig.nameMaxChars) : null;
  const from = name ? `${name} <${message.email}>` : message.email;
  return {
    from: settings.from,
    to: [settings.to],
    reply_to: message.email,
    subject: oneLine(`Contact form: ${name ?? message.email}`, settings.subjectMaxChars),
    text: [
      "New message from the Contact us page.",
      "",
      `From: ${from}`,
      `Sent: ${sentAt.format(message.createdAt)} UTC`,
      `Message #${message.id}:`,
      "",
      safeForTerminal(message.message),
      "",
      "--",
      `Reply to this email to answer them; your reply goes to ${message.email}.`,
    ].join("\n"),
  };
}

export async function emailContactMessage(
  message: StoredContactMessage,
  settings: EmailSettings,
  fetchFn: typeof fetch = fetch,
): Promise<NotifyOutcome> {
  const apiKey = settings.apiKey?.trim();
  if (!apiKey || !settings.to) return { status: "off" };

  try {
    const response = await fetchFn(settings.apiUrl, {
      method: "POST",
      headers: {
        authorization: `Bearer ${apiKey}`,
        "content-type": "application/json",
        // Resend sends one email per key, so a retried request never sends the message twice.
        "idempotency-key": `contact-message-${message.id}`,
      },
      body: JSON.stringify(contactEmail(message, { ...settings, to: settings.to })),
      signal: AbortSignal.timeout(settings.timeoutMs),
    });
    const body = await response.text();
    if (!response.ok) {
      let detail = body;
      try {
        detail = (JSON.parse(body) as { message?: string }).message ?? body;
      } catch {}
      return { status: "failed", reason: `Resend answered HTTP ${response.status}: ${detail.slice(0, 300)}` };
    }
    return { status: "sent", id: (JSON.parse(body) as { id?: string }).id ?? "" };
  } catch (error) {
    return { status: "failed", reason: error instanceof Error ? error.message : String(error) };
  }
}

/** Emails a stored message (by default with the settings from config.ts) and logs what happened. Never throws. */
export async function notifyTeam(
  message: StoredContactMessage,
  { settings = { ...contactConfig.email, apiKey: process.env.RESEND_API_KEY }, fetchFn = fetch }: { settings?: EmailSettings; fetchFn?: typeof fetch } = {},
): Promise<NotifyOutcome> {
  const outcome = await emailContactMessage(message, settings, fetchFn);
  if (outcome.status === "failed") {
    console.error(`[contact] Could not email message #${message.id}; it is stored (npm run contact:list): ${outcome.reason}`);
  } else if (outcome.status === "off") {
    console.warn(`[contact] Message #${message.id} stored; email is off (set RESEND_API_KEY and CONTACT_NOTIFY_TO).`);
  }
  return outcome;
}
