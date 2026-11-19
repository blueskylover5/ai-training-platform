"use client";

import Image from "next/image";
import { useEffect, useState, useSyncExternalStore } from "react";
import type { HeroBackground } from "@/content/landing";

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
 * The hero's background slideshow: each photo fades into the next every `intervalMs`, behind a dark
 * layer that keeps the headline readable. Decoration only, so screen readers skip it; visitors who
 * ask for less motion see the first photo only.
 */
export function HeroBackdrop({ images, intervalMs }: { images: HeroBackground[]; intervalMs: number }) {
  const [index, setIndex] = useState(0);
  const reducedMotion = usePrefersReducedMotion();
  const moving = !reducedMotion && images.length > 1;

  useEffect(() => {
    if (!moving) return;
    const timer = setInterval(() => setIndex((i) => (i + 1) % images.length), intervalMs);
    return () => clearInterval(timer);
  }, [moving, intervalMs, images.length]);

  return (
    <div aria-hidden="true" className="absolute inset-0 overflow-hidden" data-hero-backdrop={index}>
      {images.map((image, i) => (
        <div
          key={i}
          className={`absolute inset-0 transition-opacity duration-[1500ms] ease-in-out motion-reduce:transition-none ${
            i === index ? "opacity-100" : "opacity-0"
          }`}
        >
          {image.src ? (
            <Image
              src={image.src}
              alt=""
              fill
              sizes="100vw"
              loading={i === 0 ? "eager" : "lazy"}
              fetchPriority={i === 0 ? "high" : "auto"}
              className="object-cover"
            />
          ) : (
            <div className={`absolute inset-0 bg-linear-to-br ${image.panel}`}>
              <div className="absolute -top-24 right-[10%] size-96 rounded-full bg-white/10" />
              <div className="absolute -bottom-16 left-[35%] size-72 rounded-full bg-white/10" />
            </div>
          )}
        </div>
      ))}
      {/* Keeps the white text readable over any photo: darkest where the text is. */}
      <div className="absolute inset-0 bg-brand-deep/80 sm:bg-transparent sm:bg-linear-to-r sm:from-brand-deep/95 sm:via-brand-deep/75 sm:to-brand-deep/35" />
    </div>
  );
}
