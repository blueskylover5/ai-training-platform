import { createHash } from "node:crypto";
import { and, count, eq, gt } from "drizzle-orm";
import { z } from "zod";
import { contactConfig } from "../config";
import type { Db } from "../db/client";
import { contactMessages } from "../db/schema";

/*
 * The contact form's server side (CON-01 to CON-06, ADR 0005): check the fields, apply the
 * per-hour limit, and store the message. Kept apart from the Server Action so tests can call it.
 */

export type ContactField = "name" | "email" | "topic" | "message" | "policy";

export type ContactResult =
  | { status: "idle" }
  | { status: "sent"; name: string | null; email: string }
  | { status: "invalid"; errors: Partial<Record<ContactField, string>>; values: ContactValues }
  | { status: "limited"; values: ContactValues };

/** What the visitor typed, sent back so the form keeps it after an error. */
export interface ContactValues {
  name: string;
  email: string;
  topic: string;
  message: string;
  /** Whether the platform-rules box was ticked. */
  policy: boolean;
}

const topicValues = contactConfig.topics.map((t) => t.value) as [string, ...string[]];

const text = (value: FormDataEntryValue | null) => (typeof value === "string" ? value.trim() : "");

const contactSchema = z.object({
  name: z.string().max(contactConfig.nameMaxChars, `Please keep your name under ${contactConfig.nameMaxChars} characters.`),
  email: z
    .string()
    .min(1, "Please enter your email address, so we can reply.")
    .max(contactConfig.emailMaxChars, "That email address is too long.")
    .pipe(z.email("Please check your email address. It should look like name@example.com.")),
  topic: z.enum(topicValues, "Please choose where you are stuck."),
  message: z
    .string()
    .min(contactConfig.messageMinChars, `Please tell us a little more (at least ${contactConfig.messageMinChars} characters).`)
    .max(contactConfig.messageMaxChars, `Please keep your message under ${contactConfig.messageMaxChars} characters.`),
  policy: z.literal("yes", "Please confirm you will follow your platform's rules."),
});

/** Salted hash of the sender's network address; the address itself is never stored. */
export function hashAddress(address: string, secret: string = contactConfig.addressHashSecret): string {
  return createHash("sha256").update(`${secret}:${address}`).digest("hex");
}

export interface SubmitContext {
  /** The sender's network address, or "unknown". */
  address: string;
  now?: Date;
}

export async function submitContactMessage(db: Db, form: FormData, context: SubmitContext): Promise<ContactResult> {
  const values: ContactValues = {
    name: text(form.get("name")),
    email: text(form.get("email")),
    topic: text(form.get("topic")),
    message: text(form.get("message")),
    policy: text(form.get("policy")) === "yes",
  };

  // CON-04: a hidden field people never see. Bots that fill it are told "sent" and nothing is stored.
  if (text(form.get("website")) !== "") {
    return { status: "sent", name: values.name || null, email: values.email };
  }

  const parsed = contactSchema.safeParse({ ...values, policy: text(form.get("policy")) });
  if (!parsed.success) {
    const errors: Partial<Record<ContactField, string>> = {};
    for (const issue of parsed.error.issues) {
      const field = issue.path[0] as ContactField;
      errors[field] ??= issue.message;
    }
    return { status: "invalid", errors, values };
  }

  const now = context.now ?? new Date();
  const addressHash = hashAddress(context.address);
  const hourAgo = new Date(now.getTime() - 60 * 60 * 1000);
  const [{ recent }] = await db
    .select({ recent: count() })
    .from(contactMessages)
    .where(and(eq(contactMessages.addressHash, addressHash), gt(contactMessages.createdAt, hourAgo)));
  if (recent >= contactConfig.maxPerAddressPerHour) {
    return { status: "limited", values };
  }

  const { name, email, topic, message } = parsed.data;
  await db.insert(contactMessages).values({
    createdAt: now,
    name: name === "" ? null : name,
    email,
    topic,
    message,
    policyConfirmedAt: now,
    addressHash,
  });
  return { status: "sent", name: name === "" ? null : name, email };
}
