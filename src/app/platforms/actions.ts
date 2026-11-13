"use server";

import { headers } from "next/headers";
import { submitContactMessage, type ContactResult } from "@/contact/submit";
import { getDb } from "@/db/server";

/**
 * The contact form's Server Action (CON-01 to CON-06). Anyone may send a message, so it
 * checks everything itself: fields, the hidden bot field and the per-hour limit.
 */
export async function sendContactMessage(_previous: ContactResult, form: FormData): Promise<ContactResult> {
  const requestHeaders = await headers();
  // Behind a hosting proxy the first forwarded address is the visitor's; locally there is none.
  const forwarded = requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim();
  const address = forwarded || requestHeaders.get("x-real-ip") || "unknown";
  return submitContactMessage(getDb(), form, { address });
}
