"use server";

import { headers } from "next/headers";
import { contactConfig } from "@/config";
import { clientAddress } from "@/contact/address";
import { submitContactMessage, type ContactResult } from "@/contact/submit";
import { getDb } from "@/db/server";

/**
 * The contact form's Server Action (CON-01 to CON-04). Anyone may send a message, so it
 * checks everything itself: fields, the hidden bot field and the per-hour limit. Failures on
 * our side come back as an "error" result, so the visitor keeps what they typed.
 */
export async function sendContactMessage(_previous: ContactResult, form: FormData): Promise<ContactResult> {
  const requestHeaders = await headers();
  const { header, trustedProxyHops } = contactConfig.address;
  // The entry our hosting proxy added, never one the visitor sent (CON-04).
  const address = clientAddress(requestHeaders.get(header), trustedProxyHops);
  return submitContactMessage(getDb(), form, { address });
}
