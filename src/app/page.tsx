import Image from "next/image";
import Link from "next/link";
import { landingConfig } from "@/config";
import { challenges, heroBackgrounds, platforms, type Challenge, type PlatformMark } from "@/content/landing";
import { updateCadence } from "@/trends/present";
import { HeroBackdrop } from "./_components/hero-backdrop";
import { HeroCta } from "./_components/hero-cta";
import { pageWidth } from "./_components/page-width";

/*
 * The home page (19 November 2026): ATRE helps people who are stuck on AI training work. The job
 * market figures moved to /market. Images for the hero background, the challenges and the
 * platforms are in src/content/landing.ts.
 */

/** Real situations people bring to us, in the owner's words; the list ends with "…" on purpose. */
const whoFor = [
  <>
    You&apos;ve been invited to the &ldquo;Chiper&rdquo; project on Afterquery, but your &ldquo;questions&rdquo; keep
    getting rejected as &ldquo;too easy&rdquo;, so you can&apos;t earn anything.
  </>,
  <>
    You&apos;ve been invited to the &ldquo;Bibliotheca&rdquo; project on Handshake, but you simply can&apos;t pass
    &ldquo;Attempt 2&rdquo;.
  </>,
  <>
    You&apos;ve accepted a project on Alignedhq, but you can&apos;t write problems so complex that even Gemini can&apos;t
    solve them.
  </>,
];

const primaryButton =
  "inline-flex items-center rounded-full px-7 py-3.5 text-lg font-semibold hover:no-underline focus-visible:outline-2 focus-visible:outline-offset-2";

export default function Home() {
  return (
    <main className="flex-1">
      <Hero />
      <WhoWeHelp />
      <Challenges />
      <Platforms />
      {/* The Telegram and Discord buttons are on Contact us only (owner's request, 19 November 2026). */}
      <MarketPointer />
    </main>
  );
}

/** The headline over a background slideshow of photos (owner's request, 19 November 2026). */
function Hero() {
  return (
    <section
      aria-labelledby="hero-title"
      className="relative isolate flex min-h-[30rem] items-center bg-brand-deep text-white sm:min-h-[36rem] lg:min-h-[42rem]"
    >
      <HeroBackdrop images={heroBackgrounds} intervalMs={landingConfig.heroBackgroundIntervalMs} />
      <div className={`${pageWidth} relative py-20 sm:py-24`}>
        <p className="text-sm font-semibold tracking-widest text-accent uppercase">AI Training Resolution Expert</p>
        <h1
          id="hero-title"
          className="mt-4 max-w-3xl text-4xl leading-[1.1] font-bold tracking-tight text-balance sm:text-6xl lg:text-7xl"
        >
          Stuck on an AI training project? We&apos;ll get you through it.
        </h1>
        <HeroCta onDark className="mt-10" />
      </div>
    </section>
  );
}

/** "Who is this for?" and "What we do", in their own section below the hero (owner's request). */
function WhoWeHelp() {
  return (
    <section aria-labelledby="who-title" className="bg-brand-wash py-16 sm:py-24">
      <div className={`${pageWidth} grid grid-cols-1 gap-10 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:items-start lg:gap-14`}>
        <div>
          <h2 id="who-title" className="text-3xl font-bold tracking-tight text-ink sm:text-4xl">
            Who is this for?
          </h2>
          <ul role="list" className="mt-8 space-y-4">
            {whoFor.map((item, i) => (
              <li
                key={i}
                className="flex gap-4 rounded-2xl bg-surface p-5 text-base leading-7 text-ink-2 shadow-[0_1px_2px_rgba(11,11,11,0.05)] sm:text-lg sm:leading-8"
              >
                <span aria-hidden="true" className="mt-2.5 size-2.5 shrink-0 rounded-full bg-brand sm:mt-3" />
                <span>{item}</span>
              </li>
            ))}
            <li className="pl-5 text-2xl leading-none text-brand" aria-label="and many more situations like these">
              …
            </li>
          </ul>
        </div>

        <div className="rounded-3xl bg-brand-deep p-7 text-white sm:p-10">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">What we do</h2>
          <p className="mt-4 text-lg leading-8 text-brand-soft">
            Tell us where you&apos;re stuck. Someone who knows these projects looks at your situation and works through
            it with you, step by step, until you have a complete solution and can get back to earning.
          </p>
          <Link
            href="/contact"
            className="mt-8 inline-flex w-full items-center justify-center rounded-full bg-accent px-6 py-3.5 text-center text-base font-semibold text-brand-deep hover:no-underline hover:brightness-105 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white sm:w-auto sm:px-7 sm:text-lg"
          >
            Tell us where you&apos;re stuck&nbsp;→
          </Link>
        </div>
      </div>
    </section>
  );
}

function Challenges() {
  return (
    <section aria-labelledby="challenges-title" className="py-16 sm:py-24">
      <div className={pageWidth}>
        <p className="text-sm font-semibold tracking-widest text-brand uppercase">You&apos;re not alone</p>
        <h2 id="challenges-title" className="mt-3 text-3xl font-bold tracking-tight text-balance text-ink sm:text-4xl">
          Are you facing these challenges?
        </h2>
        <p className="mt-4 max-w-3xl text-lg leading-8 text-ink-2">
          These are the problems people bring to us most often. If one of them sounds like you, we can help.
        </p>
        <ul role="list" className="mt-10 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {challenges.map((challenge) => (
            <ChallengeCard key={challenge.key} challenge={challenge} />
          ))}
        </ul>
        <div className="mt-12 flex flex-col items-start gap-4 rounded-3xl bg-brand-wash p-6 sm:flex-row sm:items-center sm:justify-between sm:p-8">
          <p className="text-xl font-semibold text-brand-ink">Sounds familiar? Tell us about it, and we&apos;ll work through it together.</p>
          <Link
            href="/contact"
            className={`${primaryButton} w-full shrink-0 justify-center text-center bg-brand text-white hover:bg-brand-strong focus-visible:outline-brand sm:w-auto`}
          >
            Get help with your challenge →
          </Link>
        </div>
      </div>
    </section>
  );
}

function ChallengeCard({ challenge }: { challenge: Challenge }) {
  return (
    <li className="overflow-hidden rounded-2xl border border-line bg-surface shadow-[0_1px_2px_rgba(11,11,11,0.04)]">
      <div className="relative aspect-[4/3]">
        {challenge.src ? (
          <Image
            src={challenge.src}
            alt={challenge.alt}
            fill
            sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
            className="object-cover"
            style={challenge.position ? { objectPosition: challenge.position } : undefined}
          />
        ) : (
          <div
            aria-hidden="true"
            className="absolute inset-0 flex items-center justify-center bg-linear-to-br from-brand-wash to-accent-wash text-6xl"
          >
            {challenge.emoji}
          </div>
        )}
      </div>
      <div className="p-6">
        <h3 className="text-xl font-semibold tracking-tight text-ink">{challenge.title}</h3>
        <p className="mt-2 text-base leading-7 text-ink-2">{challenge.text}</p>
      </div>
    </li>
  );
}

function Platforms() {
  return (
    <section aria-labelledby="platforms-title" className="border-y border-line bg-tint py-14 sm:py-16">
      <div className={pageWidth}>
        <h2 id="platforms-title" className="text-center text-lg font-semibold text-ink-2">
          We help with projects on platforms like these
        </h2>
        <ul role="list" className="mt-8 flex flex-wrap justify-center gap-3 sm:gap-4">
          {platforms.map((platform) => (
            <PlatformBadge key={platform.name} platform={platform} />
          ))}
        </ul>
        <p className="mt-8 text-center text-sm text-ink-3">
          Names and logos belong to their owners. We are not affiliated with any of these platforms.
        </p>
      </div>
    </section>
  );
}

function PlatformBadge({ platform }: { platform: PlatformMark }) {
  return (
    <li className="flex h-14 items-center gap-3 rounded-xl border border-line bg-surface px-4 text-base font-semibold text-ink">
      {platform.logo ? (
        // The name sits next to it, so the icon itself needs no description.
        <Image src={platform.logo} alt="" width={32} height={32} className="size-8 rounded-lg object-contain" />
      ) : (
        <span aria-hidden="true" className="flex size-8 items-center justify-center rounded-lg bg-brand text-sm font-bold text-white">
          {platform.name.charAt(0).toUpperCase()}
        </span>
      )}
      {platform.name}
    </li>
  );
}

function MarketPointer() {
  return (
    <section aria-labelledby="market-title" className="py-20 sm:py-28">
      <div className={pageWidth}>
        <div className="rounded-3xl bg-brand-deep p-8 text-white sm:p-12">
          <h2 id="market-title" className="text-2xl font-bold tracking-tight sm:text-3xl">
            Where is the work right now?
          </h2>
          <p className="mt-3 max-w-2xl text-lg leading-8 text-brand-soft">
            Open roles, what they pay and which platforms are hiring, updated {updateCadence()}.
          </p>
          <div className="mt-8 flex flex-wrap gap-4">
            <Link href="/market" className={`${primaryButton} bg-white text-brand-deep hover:bg-brand-wash focus-visible:outline-white`}>
              See the job market →
            </Link>
            <Link
              href="/platforms"
              className={`${primaryButton} border border-white/30 text-white hover:bg-white/10 focus-visible:outline-white`}
            >
              Compare platforms →
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
