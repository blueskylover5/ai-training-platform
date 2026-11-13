import { trendsConfig } from "@/config";
import { formatDataDate } from "@/trends/present";

/** TRD-04: "Data: AITraining.jobs open data (CC BY 4.0), [date]", with links. Same wording as creditLine(). */
export function Credit({ dataDate, className = "" }: { dataDate: string; className?: string }) {
  const { name, url, license, licenseUrl } = trendsConfig.credit;
  return (
    <p className={`text-xs leading-5 text-ink-2 ${className}`}>
      Data: <a href={url}>{name}</a> (<a href={licenseUrl}>{license}</a>), {formatDataDate(dataDate)}
    </p>
  );
}
