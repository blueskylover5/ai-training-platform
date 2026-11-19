"use client";

import { useActionState, useEffect, useRef, useState, type ReactNode } from "react";
import type { ContactField, ContactResult } from "@/contact/submit";
import { sendContactMessage } from "./actions";

const initial: ContactResult = { status: "idle" };

const input =
  "block w-full rounded-xl border border-line-strong bg-surface px-4 py-3 text-base text-ink placeholder:text-ink-3 focus:border-series focus:outline-none focus:ring-4 focus:ring-series/15 aria-[invalid=true]:border-error";

/** The settings the form needs, passed in so server-only configuration never reaches the browser. */
export interface ContactFormSettings {
  nameMaxChars: number;
  emailMaxChars: number;
  messageMinChars: number;
  messageMaxChars: number;
  /** Name of the hidden anti-bot field (CON-04). */
  honeypotField: string;
}

/** The contact form (CON-01 to CON-03). Works without JavaScript too; the Server Action checks everything again. */
export function ContactForm({ settings }: { settings: ContactFormSettings }) {
  // A new key starts a fresh form after "Send another message".
  const [round, setRound] = useState(0);
  return <ContactFormRound key={round} settings={settings} onAnother={() => setRound((n) => n + 1)} />;
}

function ContactFormRound({ settings, onAnother }: { settings: ContactFormSettings; onAnother: () => void }) {
  const [state, formAction, pending] = useActionState(sendContactMessage, initial);
  const values = state.status === "invalid" || state.status === "limited" || state.status === "error" ? state.values : null;
  const errors = state.status === "invalid" ? state.errors : {};

  // After each answer React resets the form to its default values, which are what was typed, so
  // the fields keep their text. The counter follows the kept text, and a new key on the notice
  // makes screen readers announce it again even when the answer is the same as last time.
  const [length, setLength] = useState(0);
  const [attempt, setAttempt] = useState(0);
  const [seen, setSeen] = useState(state);
  if (seen !== state) {
    setSeen(state);
    setAttempt((n) => n + 1);
    setLength(values?.message.length ?? 0);
  }

  const doneRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    if (state.status === "sent") doneRef.current?.focus();
  }, [state.status]);

  if (state.status === "sent") {
    return (
      <div role="status" className="flex flex-col items-start gap-4 py-6">
        <span aria-hidden="true" className="flex size-12 items-center justify-center rounded-full bg-good-wash text-2xl text-good">
          ✓
        </span>
        <h3 ref={doneRef} tabIndex={-1} className="text-2xl font-semibold tracking-tight text-balance text-ink focus:outline-none">
          Thank you{state.name ? `, ${state.name}` : ""}. Your message has reached us.
        </h3>
        <p className="text-lg leading-8 text-ink-2">
          We&apos;ll reply to <span className="font-medium text-ink">{state.email}</span>. Please check your spam folder if
          you don&apos;t see our answer.
        </p>
        <button
          type="button"
          onClick={onAnother}
          className="mt-2 rounded-full border border-line-strong px-6 py-3 text-base font-medium text-ink hover:border-ink"
        >
          Send another message
        </button>
      </div>
    );
  }

  const describedBy = (field: ContactField, extra?: string) =>
    [errors[field] ? `contact-${field}-error` : null, extra].filter(Boolean).join(" ") || undefined;

  return (
    <form action={formAction} className="relative flex flex-col gap-6">
      {state.status === "limited" && (
        <p key={attempt} role="alert" className="rounded-xl border border-warning/60 bg-warning-wash px-5 py-4 text-base leading-7 text-ink">
          You&apos;ve already sent a few messages in the last hour. Please try again later.
        </p>
      )}
      {state.status === "error" && (
        <p key={attempt} role="alert" className="rounded-xl border border-error/40 bg-error-wash px-5 py-4 text-base leading-7 text-ink">
          Sorry, something went wrong on our side and your message wasn&apos;t sent. Please try again in a few minutes.
        </p>
      )}
      {state.status === "invalid" && (
        <p key={attempt} role="alert" className="rounded-xl border border-error/40 bg-error-wash px-5 py-4 text-base leading-7 text-ink">
          Please check the {Object.keys(errors).length === 1 ? "field" : "fields"} marked below.
        </p>
      )}

      <div className="grid gap-6 sm:grid-cols-2">
        <Field id="contact-name" label="Your name" optional error={errors.name}>
          <input
            id="contact-name"
            name="name"
            type="text"
            autoComplete="name"
            maxLength={settings.nameMaxChars}
            defaultValue={values?.name}
            aria-invalid={errors.name ? true : undefined}
            aria-describedby={describedBy("name")}
            className={input}
          />
        </Field>
        <Field id="contact-email" label="Your email" error={errors.email}>
          <input
            id="contact-email"
            name="email"
            type="email"
            required
            autoComplete="email"
            inputMode="email"
            maxLength={settings.emailMaxChars}
            defaultValue={values?.email}
            aria-invalid={errors.email ? true : undefined}
            aria-describedby={describedBy("email")}
            className={input}
          />
        </Field>
      </div>

      <Field id="contact-message" label="Tell us what's happening" error={errors.message}>
        <textarea
          id="contact-message"
          name="message"
          required
          rows={6}
          minLength={settings.messageMinChars}
          maxLength={settings.messageMaxChars}
          defaultValue={values?.message}
          onChange={(event) => setLength(event.currentTarget.value.length)}
          placeholder="For example: I passed the onboarding on two platforms but haven't had any projects for a month."
          aria-invalid={errors.message ? true : undefined}
          aria-describedby={describedBy("message", "contact-message-count")}
          className={`${input} min-h-40 resize-y leading-7`}
        />
        <p id="contact-message-count" className="mt-2 text-right text-sm tabular-nums text-ink-3">
          {length} / {settings.messageMaxChars}
        </p>
      </Field>

      {/* CON-04: left empty by people, who never see it; bots tend to fill it in. Its name and label
          match no profile field, so browsers and password managers have nothing to autofill. */}
      <div aria-hidden="true" className="absolute -left-[10000px] h-px w-px overflow-hidden">
        <label htmlFor="contact-hp">Leave this field empty</label>
        <input id="contact-hp" name={settings.honeypotField} type="text" tabIndex={-1} autoComplete="off" />
      </div>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <button
          type="submit"
          disabled={pending}
          className="inline-flex h-14 items-center justify-center rounded-full bg-brand px-8 text-lg font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-wait disabled:opacity-60"
        >
          {pending ? "Sending…" : "Send message"}
        </button>
        <p className="text-sm leading-6 text-ink-2">We use your email only to reply to you.</p>
      </div>
    </form>
  );
}

function Field({
  id,
  label,
  optional = false,
  error,
  children,
}: {
  id: string;
  label: string;
  optional?: boolean;
  error?: string;
  children: ReactNode;
}) {
  return (
    <div>
      <label htmlFor={id} className="mb-2 block text-base font-medium text-ink">
        {label}
        {optional && <span className="font-normal text-ink-2"> (optional)</span>}
      </label>
      {children}
      {error && <FieldError id={`${id}-error`}>{error}</FieldError>}
    </div>
  );
}

function FieldError({ id, children }: { id: string; children: ReactNode }) {
  return (
    <p id={id} className="mt-2 text-base leading-6 text-error">
      {children}
    </p>
  );
}
