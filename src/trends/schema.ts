import { z } from "zod";

/**
 * Expected shape of AITraining.jobs open data (TRD-02). Unknown extra fields are ignored;
 * a missing or changed required field, a duplicate slug, or a licence change rejects the file.
 */

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "expected a YYYY-MM-DD date");
const count = z.number().int().nonnegative();
const amount = z.number().nonnegative();
const slug = z.string().min(1);

/** The data may be reused only while it stays under CC BY 4.0. */
const ccBy4 = z
  .string()
  .refine((value) => value.includes("creativecommons.org/licenses/by/4.0"), {
    message: "licence is no longer CC BY 4.0",
  });

function uniqueSlugs<T extends { slug: string }>(items: T[], ctx: z.RefinementCtx) {
  const seen = new Set<string>();
  for (const item of items) {
    if (seen.has(item.slug)) ctx.addIssue({ code: "custom", message: `duplicate slug "${item.slug}"` });
    seen.add(item.slug);
  }
}

export const rolesFileSchema = z.object({
  license: ccBy4,
  updated: z.string(),
  temporal_coverage: isoDate,
  totals: z.object({ open_roles: count, platforms_live: count, new_last_7d: count }),
  recent_market_momentum: z.object({
    weekly: z.array(z.object({ week_start: isoDate, new_roles: count })),
  }),
  open_by_work_type: z
    .array(
      z.object({
        slug,
        label: z.string().min(1),
        open_count: count,
        currency: z.string().nullish(),
        unit: z.string().nullish(),
        median: amount.nullish(),
        typical_low: amount.nullish(),
        typical_high: amount.nullish(),
        rate_samples: count.nullish(),
        platforms: count.nullish(),
      }),
    )
    .min(1)
    .superRefine(uniqueSlugs),
  open_by_platform: z
    .array(z.object({ slug, name: z.string().min(1), open_count: count }))
    .min(1)
    .superRefine(uniqueSlugs),
});

export const payFileSchema = z.object({
  license: ccBy4,
  updated: z.string(),
  temporal_coverage: isoDate,
  pay_by_work_type: z
    .array(
      z.object({
        slug,
        label: z.string().min(1),
        currency: z.string().min(1),
        unit: z.string().min(1),
        median: amount,
        typical_low: amount,
        typical_high: amount,
        rate_samples: count,
        platforms: count,
        open_total: count.nullish(),
        unpriced: count.nullish(),
      }),
    )
    .min(1)
    .superRefine(uniqueSlugs),
});

export type RolesFile = z.infer<typeof rolesFileSchema>;
export type PayFile = z.infer<typeof payFileSchema>;

/** Short, readable summary of validation problems for alerts. */
export function describeIssues(error: z.ZodError, limit = 5): string {
  const lines = error.issues
    .slice(0, limit)
    .map((issue) => `${issue.path.length ? issue.path.join(".") : "(root)"}: ${issue.message}`);
  const more = error.issues.length > limit ? `; and ${error.issues.length - limit} more` : "";
  return lines.join("; ") + more;
}
