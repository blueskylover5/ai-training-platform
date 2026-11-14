import { and, count, eq, gt, sql } from "drizzle-orm";
import { z } from "zod";
import { contactConfig } from "../config";
import type { Db } from "../db/client";
import { contactMessages } from "../db/schema";
import { hashAddress } from "./address";

/*
 * The contact form's server side (CON-01 to CON-04, ADR 0005): check the fields, apply the
 * per-hour limit, and store the message. Kept apart from the Server Action so tests can call it.
 */

export type ContactField = "name" | "email" | "message";

export type ContactResult =
  | { status: "idle" }
  | { status: "sent"; name: string | null; email: string }
  | { status: "invalid"; errors: Partial<Record<ContactField, string>>; values: ContactValues }
  | { status: "limited"; values: ContactValues }
  /** Something failed on our side (database, configuration); nothing was stored. */
  | { status: "error"; values: ContactValues };

/** What the visitor typed, sent back so the form keeps it after an error. */
export interface ContactValues {
  name: string;
  email: string;
  message: string;
}

const text = (value: FormDataEntryValue | null) => (typeof value === "string" ? value.trim() : "");

/**
 * Form submissions send line breaks as CRLF; the browser's counter and maxlength count one
 * character each. Normalising first means both sides count the same (CON-02).
 */
const multiline = (value: FormDataEntryValue | null) => text(value).replace(/\r\n?/g, "\n");

const contactSchema = z.object({
  name: z.string().max(contactConfig.nameMaxChars, `Please keep your name under ${contactConfig.nameMaxChars} characters.`),
  email: z
    .string()
    .min(1, "Please enter your email address, so we can reply.")
    .max(contactConfig.emailMaxChars, "That email address is too long.")
    .pipe(z.email("Please check your email address. It should look like name@example.com.")),
  message: z
    .string()
    .min(contactConfig.messageMinChars, `Please tell us a little more (at least ${contactConfig.messageMinChars} characters).`)
    .max(contactConfig.messageMaxChars, `Please keep your message under ${contactConfig.messageMaxChars} characters.`),
});

export interface SubmitContext {
  /** The sender's network address (see clientAddress), or "unknown". */
  address: string;
  now?: Date;
  /** Overrides the hash secret; tests use it. */
  hashSecret?: string;
}

export async function submitContactMessage(db: Db, form: FormData, context: SubmitContext): Promise<ContactResult> {
  const values: ContactValues = {
    name: text(form.get("name")),
    email: text(form.get("email")),
    message: multiline(form.get("message")),
  };

  // CON-04: a hidden field people never see. Bots that fill it are told "sent" and nothing is stored.
  // The log line shows how often it happens, in case real visitors ever trip it.
  if (text(form.get(contactConfig.honeypotField)) !== "") {
    console.warn("[contact] Hidden anti-bot field was filled; message not stored.");
    return { status: "sent", name: values.name || null, email: values.email };
  }

  const parsed = contactSchema.safeParse(values);
  if (!parsed.success) {
    const errors: Partial<Record<ContactField, string>> = {};
    for (const issue of parsed.error.issues) {
      const field = issue.path[0] as ContactField;
      errors[field] ??= issue.message;
    }
    return { status: "invalid", errors, values };
  }

  const now = context.now ?? new Date();
  const { name, email, message } = parsed.data;
  try {
    const addressHash = hashAddress(context.address, context.hashSecret);
    const hourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    // CON-04: count and insert under a lock on this address, so simultaneous messages
    // cannot all see "fewer than the limit" and all be stored.
    const stored = await db.transaction(async (tx) => {
      await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${addressHash}, 0))`);
      const [{ recent }] = await tx
        .select({ recent: count() })
        .from(contactMessages)
        .where(and(eq(contactMessages.addressHash, addressHash), gt(contactMessages.createdAt, hourAgo)));
      if (recent >= contactConfig.maxPerAddressPerHour) return false;
      await tx.insert(contactMessages).values({
        createdAt: now,
        name: name === "" ? null : name,
        email,
        message,
        addressHash,
      });
      return true;
    });
    if (!stored) return { status: "limited", values };
  } catch (error) {
    // The visitor keeps what they typed and can try again; the details go to the server log only.
    console.error("[contact] Could not store a contact message:", error);
    return { status: "error", values };
  }
  return { status: "sent", name: name === "" ? null : name, email };
}
