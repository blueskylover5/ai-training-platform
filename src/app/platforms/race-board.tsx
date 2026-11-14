"use client";

import { useEffect, useRef, useState, useSyncExternalStore, type CSSProperties, type KeyboardEvent } from "react";
import type { BoardEntry, BoardRace, RaceBoardData, RaceKey } from "@/trends/race";

/*
 * The animated leaderboard. Bars grow from the start line when the page opens (pure CSS, so it
 * works before JavaScript loads), slide into their new places when you switch races, and the
 * numbers count to their new values. With reduced motion everything changes at once.
 * The board itself is hidden from screen readers; an ordered list and the data table carry the content.
 */

const count = new Intl.NumberFormat("en-US");
const HASH_PREFIX = "#race-";
const SWITCH_MS = 700;
const STAGGER_MS = 70;

// The selected race lives in the URL hash (#race-new), so each race has a link to share (TRD-10).
function subscribeToHash(onChange: () => void) {
  window.addEventListener("hashchange", onChange);
  return () => window.removeEventListener("hashchange", onChange);
}
const readHash = () => window.location.hash;
const serverHash = () => "";

const motionQuery = "(prefers-reduced-motion: reduce)";
function subscribeToMotion(onChange: () => void) {
  const query = window.matchMedia(motionQuery);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}
const readReducedMotion = () => window.matchMedia(motionQuery).matches;
const serverReducedMotion = () => false;

/** Counts from the number shown last to `target`. */
function useCountTo(target: number, duration: number): number {
  const [shown, setShown] = useState(target);
  const shownRef = useRef(target);
  useEffect(() => {
    const from = shownRef.current;
    if (from === target) return;
    const start = performance.now();
    let frame = requestAnimationFrame(function step(now) {
      const t = duration > 0 ? Math.min(1, (now - start) / duration) : 1;
      const value = Math.round(from + (target - from) * (1 - (1 - t) ** 3));
      shownRef.current = value;
      setShown(value);
      if (t < 1) frame = requestAnimationFrame(step);
    });
    return () => cancelAnimationFrame(frame);
  }, [target, duration]);
  return shown;
}

export function RaceBoard({ board }: { board: RaceBoardData }) {
  const { races, lanes } = board;
  const hash = useSyncExternalStore(subscribeToHash, readHash, serverHash);
  const reducedMotion = useSyncExternalStore(subscribeToMotion, readReducedMotion, serverReducedMotion);
  const [previousKey, setPreviousKey] = useState<RaceKey | null>(null);
  const [run, setRun] = useState(0);
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);

  // Other links on the page (#pay, #contact) change the hash too; keep showing the last race picked.
  const [raceHash, setRaceHash] = useState(hash);
  if (hash !== raceHash && hash.startsWith(HASH_PREFIX)) setRaceHash(hash);

  const available = races.filter((r) => r.available);
  const fromHash = available.find((r) => HASH_PREFIX + r.key === raceHash);
  const active = fromHash ?? available[0] ?? races[0];
  const previous = previousKey && previousKey !== active.key ? races.find((r) => r.key === previousKey) : undefined;

  function select(race: BoardRace) {
    if (!race.available || race.key === active.key) return;
    setPreviousKey(active.key);
    window.history.replaceState(null, "", HASH_PREFIX + race.key);
    window.dispatchEvent(new HashChangeEvent("hashchange"));
  }

  function onTabKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    const order = available.map((r) => r.key);
    const at = order.indexOf(active.key);
    const next =
      event.key === "ArrowRight" ? order[(at + 1) % order.length]
      : event.key === "ArrowLeft" ? order[(at - 1 + order.length) % order.length]
      : event.key === "Home" ? order[0]
      : event.key === "End" ? order[order.length - 1]
      : undefined;
    if (next === undefined) return;
    event.preventDefault();
    const race = races.find((r) => r.key === next)!;
    select(race);
    tabRefs.current[races.indexOf(race)]?.focus();
  }

  const positions = new Map(active.entries.map((e, i) => [e.slug, i]));
  const bySlug = new Map(active.entries.map((e) => [e.slug, e]));
  const previousRanks = previous ? new Map(previous.entries.map((e) => [e.slug, e.rank])) : null;
  const leader = active.entries[0]?.value ?? 0;
  const top = active.entries.filter((e) => e.racing);
  // The board fits the race on show; lanes that drop out fade away just below it.
  const laneCount = Math.max(1, top.length);

  return (
    <div>
      <div role="tablist" aria-label="Choose a race" className="flex flex-wrap gap-2">
        {races.map((race, i) => {
          const selected = race.key === active.key;
          return (
            <button
              key={race.key}
              ref={(el) => {
                tabRefs.current[i] = el;
              }}
              type="button"
              role="tab"
              id={`race-tab-${race.key}`}
              aria-selected={selected}
              aria-controls="race-panel"
              aria-disabled={!race.available || undefined}
              tabIndex={selected ? 0 : -1}
              title={race.unavailableNote ?? undefined}
              onClick={() => select(race)}
              onKeyDown={onTabKeyDown}
              className={`flex items-center gap-2 rounded-full border px-5 py-2.5 text-base font-medium transition-colors ${
                selected
                  ? "border-ink bg-ink text-page"
                  : race.available
                    ? "border-line bg-surface text-ink hover:border-ink-3"
                    : "cursor-not-allowed border-line bg-surface text-ink-3"
              }`}
            >
              <span aria-hidden="true">{race.emoji}</span>
              {race.label}
            </button>
          );
        })}
      </div>

      <div id="race-panel" role="tabpanel" aria-labelledby={`race-tab-${active.key}`} className="mt-8">
        <div className="flex flex-col items-start gap-4 sm:flex-row sm:justify-between">
          <h3 className="min-w-0 text-2xl font-semibold tracking-tight text-ink sm:text-3xl">{active.question}</h3>
          {!reducedMotion && (
            <button
              type="button"
              onClick={() => setRun((n) => n + 1)}
              className="shrink-0 rounded-full border border-line-strong bg-surface px-5 py-2 text-base text-ink hover:border-ink"
            >
              <span aria-hidden="true">↻ </span>Run it again
            </button>
          )}
        </div>
        <p className="mt-3 max-w-3xl text-base leading-7 text-ink-2 sm:text-lg sm:leading-8">{active.description}</p>

        <div aria-live="polite" className="mt-6 rounded-xl bg-tint px-5 py-4 sm:px-6 sm:py-5">
          <p className="text-sm font-semibold tracking-wide text-ink-2 uppercase">
            <span aria-hidden="true">🎙️ </span>Race commentary
          </p>
          <ul className="mt-2 flex flex-col gap-1.5 text-base leading-7 text-ink sm:text-lg sm:leading-8">
            {active.commentary.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </div>

        <ol className="sr-only">
          {top.map((e) => (
            <li key={e.slug}>
              {e.rank}. {e.name}: {count.format(e.value)} {active.unit}
            </li>
          ))}
        </ol>

        <div
          aria-hidden="true"
          className={`relative mt-12 [--row-h:4.25rem] sm:[--row-h:3.25rem] ${slide} motion-safe:transition-[height]`}
          style={{ height: `calc(var(--row-h) * ${laneCount})` }}
        >
          <FinishLine />
          <ol key={run} className="absolute inset-0">
            {lanes.map(({ slug, name }) => {
              const entry = bySlug.get(slug);
              const shown = entry?.racing === true;
              const moved = previousRanks && entry ? (previousRanks.get(slug) ?? null) : null;
              return (
                <Lane
                  key={slug}
                  name={name}
                  entry={entry}
                  position={shown ? (positions.get(slug) ?? laneCount) : laneCount}
                  shown={shown}
                  ratio={entry && leader > 0 ? entry.value / leader : 0}
                  unit={active.unit}
                  movedFrom={shown ? moved : null}
                  reducedMotion={reducedMotion}
                />
              );
            })}
          </ol>
        </div>
      </div>
    </div>
  );
}

/** The grid every lane shares, so the finish line lines up with the bars. */
const laneGrid =
  "grid grid-cols-[2rem_minmax(0,1fr)_3rem] items-center gap-x-3 gap-y-1.5 px-1 sm:grid-cols-[2rem_minmax(0,13rem)_minmax(0,1fr)_3rem] sm:gap-x-4 sm:px-3";
const trackCell = "col-start-2 col-span-2 row-start-2 sm:col-start-3 sm:col-span-1 sm:row-start-1";
/** Timing for lanes sliding, bars resizing and the board changing height; only without reduced motion. */
const slide = "motion-safe:duration-700 motion-safe:ease-[cubic-bezier(0.2,0.7,0.2,1)]";
/** Room kept after the longest bar for its number. */
const valueRoom = "3.75rem";

function FinishLine() {
  return (
    <div className={`${laneGrid} pointer-events-none absolute inset-x-0 -top-6 -bottom-1 grid-rows-1 sm:grid-rows-1`}>
      <div className={`relative h-full ${trackCell.replace("row-start-2", "row-start-1")}`}>
        <span
          className="absolute top-0 text-xs font-semibold tracking-widest text-ink-3 uppercase"
          style={{ left: `calc(100% - ${valueRoom})`, transform: "translateX(-50%)" }}
        >
          Finish
        </span>
        <span
          className="absolute top-5 bottom-0 w-1.5 opacity-30"
          style={{
            left: `calc(100% - ${valueRoom} - 3px)`,
            background: "repeating-conic-gradient(var(--ink) 0 25%, transparent 0 50%) 0 0 / 6px 6px",
          }}
        />
      </div>
    </div>
  );
}

function Lane({
  name,
  entry,
  position,
  shown,
  ratio,
  unit,
  movedFrom,
  reducedMotion,
}: {
  name: string;
  entry: BoardEntry | undefined;
  position: number;
  shown: boolean;
  ratio: number;
  unit: string;
  movedFrom: number | null;
  reducedMotion: boolean;
}) {
  const value = useCountTo(entry?.value ?? 0, reducedMotion ? 0 : SWITCH_MS);
  const rank = entry?.rank ?? 0;
  const delay = `${position * STAGGER_MS}ms`;
  const style: CSSProperties = {
    transform: `translateY(calc(var(--row-h) * ${position}))`,
    opacity: shown ? 1 : 0,
    height: "var(--row-h)",
  };
  const change = movedFrom === null ? null : movedFrom - rank;

  return (
    <li
      className={`group absolute inset-x-0 top-0 flex items-center ${slide} motion-safe:transition-[transform,opacity] ${shown ? "" : "pointer-events-none"}`}
      style={style}
    >
      <div className={`${laneGrid} w-full rounded-lg py-1.5 hover:bg-tint`}>
        <span className="col-start-1 row-start-1 sm:row-span-1">
          <RankBadge rank={rank} />
        </span>
        <span className="col-start-2 row-start-1 truncate text-base font-medium text-ink" title={name}>
          {name}
        </span>
        <span className={`relative flex h-6 items-center ${trackCell}`}>
          <span
            className={`h-5 shrink-0 origin-left rounded-r-[4px] bg-series ${slide} motion-safe:animate-race-grow motion-safe:transition-[width]`}
            style={{ width: `calc((100% - ${valueRoom}) * ${ratio})`, animationDelay: delay }}
          />
          <span
            className="ml-2.5 text-base font-semibold tabular-nums text-ink motion-safe:animate-race-fade"
            style={{ animationDelay: `calc(${delay} + 700ms)` }}
          >
            {count.format(value)}
          </span>
          {entry && (
            <span className="pointer-events-none absolute bottom-full left-0 z-10 mb-2 hidden w-max max-w-[min(28rem,calc(100vw-2.5rem))] rounded-lg bg-ink px-3 py-2 text-sm leading-5 text-page shadow-lg group-hover:block">
              {name}: {count.format(entry.value)} {unit}
              {entry.detail ? ` · ${entry.detail}` : ""}
            </span>
          )}
        </span>
        <span className="col-start-3 row-start-1 text-right text-sm font-medium tabular-nums text-ink-2 sm:col-start-4">
          {change !== null && change !== 0 && (
            <span title={`${change > 0 ? "Up" : "Down"} ${Math.abs(change)} places`}>
              {change > 0 ? "▲" : "▼"}
              {Math.abs(change)}
            </span>
          )}
          {change === 0 && <span title="Same place">=</span>}
        </span>
      </div>
    </li>
  );
}

const medal: Record<number, string> = {
  1: "bg-gold text-medal-ink",
  2: "bg-silver text-medal-ink",
  3: "bg-bronze text-medal-ink",
};

function RankBadge({ rank }: { rank: number }) {
  return (
    <span
      className={`flex size-8 items-center justify-center rounded-full text-sm font-semibold tabular-nums ${
        medal[rank] ?? "border border-line text-ink-2"
      }`}
    >
      {rank}
    </span>
  );
}
