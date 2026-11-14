import { formatDataDate } from "@/trends/present";

/** TRD-09 */
export function StaleNotice({ dataDate }: { dataDate: string }) {
  return (
    <div role="status" className="flex gap-3 rounded-2xl border border-warning/60 bg-warning-wash px-6 py-5 text-base leading-7 text-ink">
      <span aria-hidden="true" className="text-lg leading-7 text-warning">
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
    <div role="status" className="rounded-2xl border border-line bg-tint px-6 py-10 text-lg leading-8 text-ink-2">
      The first daily update has not run yet. Figures will appear here after it does.
    </div>
  );
}
