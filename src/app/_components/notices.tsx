import { formatDataDate } from "@/trends/present";

/** TRD-09 */
export function StaleNotice({ dataDate }: { dataDate: string }) {
  return (
    <div role="status" className="flex gap-3 rounded-xl border border-warning/60 bg-warning-wash px-5 py-4 text-sm text-ink">
      <span aria-hidden="true" className="text-base leading-5 text-warning">
        ⚠
      </span>
      <p>
        <span className="font-medium">Out of date.</span> These figures are from {formatDataDate(dataDate)}. The
        latest daily update has not arrived yet.
      </p>
    </div>
  );
}

export function NoDataYet() {
  return (
    <div role="status" className="rounded-xl border border-line bg-surface px-5 py-8 text-ink-2">
      The first daily update has not run yet. Figures will appear here after it does.
    </div>
  );
}
