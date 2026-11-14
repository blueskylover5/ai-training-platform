import type { ReactNode } from "react";
import { trendsConfig } from "@/config";
import { formatCount, formatMoney, publicPay } from "@/trends/present";
import type { PayRow } from "@/trends/queries";
import { ChartCard, DataTable } from "./chart-card";
import { PayRanges } from "./charts";

/**
 * Advertised hourly pay for each kind of work, shared by the Job market and Platform guide pages,
 * so the "advertised" wording (TRD-07) and hidden thin figures (TRD-08) live in one place.
 */
export function PayBySectorCard({
  id,
  title,
  rowLabel,
  lead = null,
  headingLevel = "h2",
  pay,
}: {
  id: string;
  title: string;
  /** Heading of the table's first column, for example "Kind of work" or "Sector". */
  rowLabel: string;
  /** Text before the standard description. */
  lead?: ReactNode;
  headingLevel?: "h2" | "h3";
  pay: { dataDate: string; rows: PayRow[] } | null;
}) {
  if (!pay || pay.rows.length === 0) return null;
  const { dataDate, rows } = pay;
  const items = rows.map((r) => ({ ...r, key: r.slug, visible: publicPay(r).visible }));
  const totalSamples = rows.reduce((sum, r) => sum + r.rateSamples, 0);
  const min = trendsConfig.minPaySamples;

  return (
    <ChartCard
      id={id}
      headingLevel={headingLevel}
      title={title}
      dataDate={dataDate}
      description={
        <>
          {lead}The dot is the median; the bar is the typical range. Based on {formatCount(totalSamples)} advertised
          rates. Figures resting on fewer than {min} rates are hidden.
        </>
      }
      table={
        <DataTable
          caption={title}
          columns={[rowLabel, "Median", "Typical range", "Rates", "Platforms"]}
          rows={items.map((r) => ({
            key: r.key,
            cells: r.visible
              ? [
                  r.label,
                  formatMoney(r.median, r.currency),
                  `${formatMoney(r.typicalLow, r.currency)}–${formatMoney(r.typicalHigh, r.currency)}`,
                  formatCount(r.rateSamples),
                  formatCount(r.platforms),
                ]
              : [r.label, "Not shown", "Not shown", formatCount(r.rateSamples), formatCount(r.platforms)],
          }))}
        />
      }
    >
      <PayRanges items={items} hiddenNote={`Fewer than ${min} advertised rates, so not shown`} />
    </ChartCard>
  );
}
