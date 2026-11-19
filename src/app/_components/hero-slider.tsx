"use client";

import Image from "next/image";
import { useEffect, useState, useSyncExternalStore } from "react";
import type { HeroSlide } from "@/content/landing";

const REDUCED_MOTION = "(prefers-reduced-motion: reduce)";

/** True when the visitor asked for less motion. Assumed on the server, so nothing moves before the page is ready. */
function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const query = window.matchMedia(REDUCED_MOTION);
      query.addEventListener("change", onChange);
      return () => query.removeEventListener("change", onChange);
    },
    () => window.matchMedia(REDUCED_MOTION).matches,
    () => true,
  );
}

/**
 * The hero's image slider. Moves on by itself every `intervalMs`, but stops while the pointer or
 * keyboard focus is on it, when the visitor presses pause, and for visitors who asked for less motion.
 */
export function HeroSlider({ slides, intervalMs }: { slides: HeroSlide[]; intervalMs: number }) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const reducedMotion = usePrefersReducedMotion();
  const rotating = !paused && !hovered && !focused && !reducedMotion && slides.length > 1;

  useEffect(() => {
    if (!rotating) return;
    const timer = setInterval(() => setIndex((i) => (i + 1) % slides.length), intervalMs);
    return () => clearInterval(timer);
  }, [rotating, intervalMs, slides.length]);

  const go = (to: number) => setIndex((to + slides.length) % slides.length);
  const control =
    "inline-flex size-10 items-center justify-center rounded-full border border-white/25 text-white hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

  return (
    <section
      aria-roledescription="carousel"
      aria-label="How we help"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocus={() => setFocused(true)}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget)) setFocused(false);
      }}
    >
      <div
        className="relative aspect-[4/3] overflow-hidden rounded-3xl shadow-2xl shadow-black/30"
        // Announce slide changes only when the visitor makes them, not while it moves by itself.
        aria-live={rotating ? "off" : "polite"}
      >
        {slides.map((slide, i) => (
          <div
            key={slide.title}
            role="group"
            aria-roledescription="slide"
            aria-label={`${i + 1} of ${slides.length}`}
            aria-hidden={i !== index}
            inert={i !== index}
            className={`absolute inset-0 transition-opacity duration-700 motion-reduce:transition-none ${
              i === index ? "opacity-100" : "opacity-0"
            }`}
          >
            {slide.src ? (
              <Image
                src={slide.src}
                alt={slide.alt}
                fill
                sizes="(min-width: 1024px) 40vw, 100vw"
                loading={i === 0 ? "eager" : "lazy"}
                fetchPriority={i === 0 ? "high" : "auto"}
                className="object-cover"
              />
            ) : (
              <div aria-hidden="true" className={`absolute inset-0 bg-linear-to-br ${slide.panel}`}>
                <div className="absolute -top-16 -right-16 size-64 rounded-full bg-white/10" />
                <div className="absolute bottom-24 -left-10 size-40 rounded-full bg-white/10" />
                <div className="absolute top-10 left-10 text-7xl font-black tracking-[0.12em] text-white/15">ATRE</div>
              </div>
            )}
            <div className="absolute inset-x-0 bottom-0 bg-linear-to-t from-black/75 via-black/40 to-transparent p-6 pt-20 sm:p-8 sm:pt-24">
              <p className="text-2xl font-bold tracking-tight text-white sm:text-3xl">{slide.title}</p>
              <p className="mt-2 text-base text-white/85 sm:text-lg">{slide.text}</p>
            </div>
          </div>
        ))}
      </div>

      {slides.length > 1 && (
        <div className="mt-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            {slides.map((slide, i) => (
              <button
                key={slide.title}
                type="button"
                onClick={() => go(i)}
                aria-label={`Show slide ${i + 1}: ${slide.title}`}
                aria-current={i === index ? "true" : undefined}
                className="flex h-10 items-center px-1 focus-visible:outline-2 focus-visible:outline-accent"
              >
                <span className={`block h-2 rounded-full transition-all ${i === index ? "w-8 bg-accent" : "w-2 bg-white/40"}`} />
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => go(index - 1)} aria-label="Previous slide" className={control}>
              <span aria-hidden="true">←</span>
            </button>
            <button
              type="button"
              onClick={() => setPaused((p) => !p)}
              aria-label={paused ? "Play the slides" : "Pause the slides"}
              className={control}
            >
              <span aria-hidden="true" className="text-sm">
                {paused ? "▶" : "❚❚"}
              </span>
            </button>
            <button type="button" onClick={() => go(index + 1)} aria-label="Next slide" className={control}>
              <span aria-hidden="true">→</span>
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
