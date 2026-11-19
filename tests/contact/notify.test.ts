import { afterEach, describe, expect, it, vi } from "vitest";
import { contactConfig } from "../../src/config";
import { contactEmail, emailContactMessage, notifyTeam, type EmailSettings, type StoredContactMessage } from "../../src/contact/notify";

const MESSAGE: StoredContactMessage = {
  id: 12,
  createdAt: new Date("2026-11-19T04:12:30Z"),
  name: "Sam",
  email: "sam@example.com",
  message: "I passed onboarding on two platforms\nbut have had no projects for a month.",
};

const SETTINGS: EmailSettings = {
  apiKey: "re_test_key",
  to: "owner@example.com",
  from: "AI Training Platform <onboarding@resend.dev>",
  apiUrl: "https://resend.test/emails",
  subjectMaxChars: 80,
  timeoutMs: 1_000,
};

/** A stand-in for Resend: records each request and answers with `status` and `body`. */
function fakeResend(status = 200, body = '{"id":"4ef9a417-02e9-4d39-ad75-9611e0fcc33c"}') {
  const calls: Array<{ url: string; init: RequestInit }> = [];
  const fetchFn = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), init: init ?? {} });
    return new Response(body, { status });
  }) as unknown as typeof fetch;
  return { fetchFn, calls };
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe("contact message email (CON-03)", () => {
  it("is plain text to the team, and replying goes to the visitor", () => {
    expect(contactEmail(MESSAGE, { ...SETTINGS, to: "owner@example.com" })).toEqual({
      from: "AI Training Platform <onboarding@resend.dev>",
      to: ["owner@example.com"],
      reply_to: "sam@example.com",
      subject: "Contact form: Sam",
      text: [
        "New message from the Contact us page.",
        "",
        "From: Sam <sam@example.com>",
        "Sent: 19 November 2026 at 04:12 UTC",
        "Message #12:",
        "",
        "I passed onboarding on two platforms",
        "but have had no projects for a month.",
        "",
        "--",
        "Reply to this email to answer them; your reply goes to sam@example.com.",
      ].join("\n"),
    });
  });

  it("names the sender by email when they gave no name", () => {
    const email = contactEmail({ ...MESSAGE, name: null }, { ...SETTINGS, to: "owner@example.com" });
    expect(email.subject).toBe("Contact form: sam@example.com");
    expect(email.text).toContain("From: sam@example.com\n");
  });

  it("keeps visitor text from breaking the subject or disguising the message", () => {
    const email = contactEmail(
      { ...MESSAGE, name: "Sam\r\nBcc: someone@example.com‮evil", message: "Pay here‮moc.elpmaxe\u0007" },
      { ...SETTINGS, to: "owner@example.com" },
    );
    expect(email.subject).not.toMatch(/[\r\n‮]/);
    expect(email.subject).toBe("Contact form: Sam Bcc: someone@example.com�evil");
    expect(email.text).toContain("Pay here�moc.elpmaxe�");
    const long = contactEmail({ ...MESSAGE, name: "N".repeat(contactConfig.nameMaxChars) }, { ...SETTINGS, to: "owner@example.com" });
    expect(long.subject).toHaveLength(SETTINGS.subjectMaxChars);
    expect(long.subject.endsWith("…")).toBe(true);
  });
});

describe("emailContactMessage (CON-03)", () => {
  it("sends through Resend, once per message", async () => {
    const { fetchFn, calls } = fakeResend();

    const outcome = await emailContactMessage(MESSAGE, SETTINGS, fetchFn);

    expect(outcome).toEqual({ status: "sent", id: "4ef9a417-02e9-4d39-ad75-9611e0fcc33c" });
    expect(calls).toHaveLength(1);
    const [{ url, init }] = calls;
    expect(url).toBe("https://resend.test/emails");
    expect(init.method).toBe("POST");
    expect(init.headers).toEqual({
      authorization: "Bearer re_test_key",
      "content-type": "application/json",
      "idempotency-key": "contact-message-12",
    });
    expect(JSON.parse(String(init.body))).toEqual(contactEmail(MESSAGE, { ...SETTINGS, to: "owner@example.com" }));
  });

  it.each([
    ["no API key", { apiKey: undefined }],
    ["a blank API key", { apiKey: "  " }],
    ["no recipient", { to: null }],
  ])("is off with %s", async (_case, change) => {
    const { fetchFn } = fakeResend();

    expect(await emailContactMessage(MESSAGE, { ...SETTINGS, ...change }, fetchFn)).toEqual({ status: "off" });
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it("reports Resend's reason when it refuses", async () => {
    const { fetchFn } = fakeResend(
      403,
      '{"statusCode":403,"message":"You can only send testing emails to your own email address.","name":"validation_error"}',
    );

    expect(await emailContactMessage(MESSAGE, SETTINGS, fetchFn)).toEqual({
      status: "failed",
      reason: "Resend answered HTTP 403: You can only send testing emails to your own email address.",
    });
  });

  it("reports a network failure instead of throwing", async () => {
    const fetchFn = vi.fn(async () => Promise.reject(new TypeError("fetch failed"))) as unknown as typeof fetch;

    expect(await emailContactMessage(MESSAGE, SETTINGS, fetchFn)).toEqual({ status: "failed", reason: "fetch failed" });
  });
});

describe("notifyTeam (CON-03)", () => {
  it("logs a failed email and says the message is stored", async () => {
    const errors = vi.spyOn(console, "error").mockImplementation(() => {});
    const { fetchFn } = fakeResend(500, '{"message":"Internal server error"}');

    const outcome = await notifyTeam(MESSAGE, { settings: SETTINGS, fetchFn });

    expect(outcome.status).toBe("failed");
    expect(errors).toHaveBeenCalledWith(
      "[contact] Could not email message #12; it is stored (npm run contact:list): Resend answered HTTP 500: Internal server error",
    );
  });

  it("says email is off when it is not set up", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { fetchFn } = fakeResend();

    expect(await notifyTeam(MESSAGE, { settings: { ...SETTINGS, apiKey: undefined }, fetchFn })).toEqual({ status: "off" });
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("email is off (set RESEND_API_KEY and CONTACT_NOTIFY_TO)"));
  });
});
