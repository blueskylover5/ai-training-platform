import { siteConfig } from "@/config";

/**
 * The ATRE logo: a lettered wordmark until the owner's logo file arrives; then swap the mark for an
 * <Image> here and everywhere picks it up. `withName` adds "AI Training Resolution Expert" beside it
 * on wider screens.
 */
export function Logo({ withName = false, onDark = false }: { withName?: boolean; onDark?: boolean }) {
  return (
    <span className="inline-flex items-center gap-3">
      <span
        aria-hidden="true"
        className="inline-flex h-9 items-center rounded-lg bg-brand px-2.5 text-lg font-black tracking-[0.12em] text-white shadow-sm"
      >
        ATRE
        <span className="ml-0.5 size-1.5 rounded-full bg-accent" />
      </span>
      <span className="sr-only">{`${siteConfig.shortName}, ${siteConfig.name}`}</span>
      {withName && (
        <span
          aria-hidden="true"
          className={`hidden text-sm leading-tight font-semibold sm:block ${onDark ? "text-brand-soft" : "text-ink-2"}`}
        >
          AI Training
          <br />
          Resolution Expert
        </span>
      )}
    </span>
  );
}
