import Link from "next/link";

/** The "Struggling with AI training?" box that sends people to the Contact us page (CON-01). */
export function ContactTeaser({ className = "" }: { className?: string }) {
  return (
    <section
      aria-labelledby="help-title"
      className={`flex flex-col items-start gap-6 rounded-3xl bg-tint p-6 sm:p-10 lg:flex-row lg:items-center lg:justify-between ${className}`}
    >
      <div className="max-w-2xl">
        <h2 id="help-title" className="text-2xl font-bold tracking-tight text-ink sm:text-3xl">
          Struggling with AI training?
        </h2>
        <p className="mt-3 text-lg leading-8 text-ink-2">
          Tell us where you&apos;re stuck and we&apos;ll work through it with you.
        </p>
      </div>
      <Link
        href="/contact"
        className="inline-flex shrink-0 items-center rounded-full bg-ink px-7 py-3.5 text-lg font-semibold text-page hover:no-underline hover:opacity-90"
      >
        Contact us →
      </Link>
    </section>
  );
}
