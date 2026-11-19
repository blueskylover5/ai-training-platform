"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { deleteVisitsAction } from "./actions";

/** One visit as the table shows it; the server formats everything. */
export interface VisitRow {
  id: number;
  time: string;
  path: string;
  ip: string;
  location: string;
  browser: string;
  userAgent: string | null;
  referrer: string;
}

const number = new Intl.NumberFormat("en-US");
const visitsWord = (n: number) => `${number.format(n)} visit${n === 1 ? "" : "s"}`;

/**
 * The visit list with selection and deletion (VIS-03): tick visits one by one, Shift-click to tick a
 * range, tick the header box for the whole page, then "Select all" for every visit in the log.
 * Deleting asks for confirmation first.
 */
export function VisitTable({ rows, total }: { rows: VisitRow[]; total: number }) {
  const [selected, setSelected] = useState<Set<number>>(() => new Set());
  /** Every visit in the log, not just this page. */
  const [everything, setEverything] = useState(false);
  const [anchor, setAnchor] = useState<number | null>(null);
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();
  const shiftHeld = useRef(false);
  const headerBox = useRef<HTMLInputElement>(null);

  // Only visits still on the page count, for example after some were deleted.
  const selectedHere = rows.filter((r) => everything || selected.has(r.id));
  const allHere = rows.length > 0 && selectedHere.length === rows.length;
  const someHere = selectedHere.length > 0 && !allHere;
  const count = everything ? total : selectedHere.length;

  useEffect(() => {
    if (headerBox.current) headerBox.current.indeterminate = someHere;
  }, [someHere]);

  function toggleRow(index: number) {
    const willSelect = !(everything || selected.has(rows[index].id));
    const [from, to] =
      shiftHeld.current && anchor !== null ? [Math.min(anchor, index), Math.max(anchor, index)] : [index, index];
    const next = new Set(everything ? rows.map((r) => r.id) : selected);
    for (let i = from; i <= to; i++) {
      if (willSelect) next.add(rows[i].id);
      else next.delete(rows[i].id);
    }
    setSelected(next);
    setEverything(false);
    setAnchor(index);
    setMessage("");
  }

  function togglePage() {
    setSelected(allHere ? new Set() : new Set(rows.map((r) => r.id)));
    setEverything(false);
    setAnchor(null);
    setMessage("");
  }

  function clear() {
    setSelected(new Set());
    setEverything(false);
    setAnchor(null);
  }

  function remove() {
    if (count === 0) return;
    const what = everything ? `all ${visitsWord(total)}` : visitsWord(count);
    if (!window.confirm(`Delete ${what}? This can't be undone.`)) return;
    const selection = everything ? { all: true } : { ids: selectedHere.map((r) => r.id) };
    startTransition(async () => {
      const result = await deleteVisitsAction(selection);
      if (result.ok) {
        clear();
        setMessage(`Deleted ${visitsWord(result.deleted)}.`);
      } else {
        setMessage(result.error);
      }
    });
  }

  const button =
    "inline-flex h-10 items-center rounded-full px-5 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-40";

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={remove}
          disabled={count === 0 || pending}
          className={`${button} bg-error text-white hover:opacity-90 focus-visible:outline-error`}
        >
          {pending ? "Deleting…" : count === 0 ? "Delete selected" : `Delete ${visitsWord(count)}`}
        </button>
        {count > 0 && !pending && (
          <button type="button" onClick={clear} className={`${button} border border-line-strong text-ink hover:border-brand`}>
            Clear selection
          </button>
        )}
        <p role="status" className="text-sm text-ink-2">
          {message || (count > 0 ? `${visitsWord(count)} selected.` : "Tick visits to select them; Shift-click selects a range.")}
        </p>
      </div>

      {allHere && total > rows.length && (
        <p className="mt-4 rounded-xl bg-brand-wash px-4 py-3 text-sm text-brand-ink">
          {everything ? (
            <>
              All {visitsWord(total)} in the log are selected.{" "}
              <button type="button" onClick={clear} className="font-semibold text-link underline underline-offset-2">
                Clear selection
              </button>
            </>
          ) : (
            <>
              All {visitsWord(rows.length)} on this page are selected.{" "}
              <button
                type="button"
                onClick={() => setEverything(true)}
                className="font-semibold text-link underline underline-offset-2"
              >
                Select all {visitsWord(total)}
              </button>
            </>
          )}
        </p>
      )}

      <div className="mt-4 overflow-x-auto rounded-2xl border border-line bg-surface">
        <table className="w-full min-w-[56rem] border-collapse text-left text-sm">
          <caption className="sr-only">Latest visits, newest first</caption>
          <thead>
            <tr className="border-b border-line text-ink-2">
              <th scope="col" className="w-12 py-1 pl-2">
                <label className="flex size-10 cursor-pointer items-center justify-center">
                  <input
                    ref={headerBox}
                    type="checkbox"
                    checked={allHere}
                    onChange={togglePage}
                    disabled={pending}
                    aria-label="Select all visits on this page"
                    className="size-4 accent-brand"
                  />
                </label>
              </th>
              {["Time (UTC)", "Page", "IP address", "Location", "Browser", "Came from"].map((c) => (
                <th key={c} scope="col" className="px-4 py-3 font-medium whitespace-nowrap">
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((v, i) => {
              const isSelected = everything || selected.has(v.id);
              return (
                <tr key={v.id} className={`border-b border-line align-top last:border-0 ${isSelected ? "bg-brand-wash" : ""}`}>
                  <td className="py-1 pl-2">
                    <label className="flex size-10 cursor-pointer items-center justify-center">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onClick={(e) => {
                          shiftHeld.current = e.shiftKey;
                        }}
                        onChange={() => toggleRow(i)}
                        disabled={pending}
                        aria-label={`Select the visit to ${v.path} at ${v.time}`}
                        className="size-4 accent-brand"
                      />
                    </label>
                  </td>
                  <td className="px-4 py-2.5 whitespace-nowrap tabular-nums text-ink">{v.time}</td>
                  <td className="px-4 py-2.5 break-all text-ink">{v.path}</td>
                  <td className="px-4 py-2.5 font-mono text-xs break-all text-ink">{v.ip}</td>
                  <td className="px-4 py-2.5 text-ink">{v.location}</td>
                  <td className="px-4 py-2.5 text-ink" title={v.userAgent ?? undefined}>
                    {v.browser}
                  </td>
                  <td className="px-4 py-2.5 break-all text-ink-2">{v.referrer}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
