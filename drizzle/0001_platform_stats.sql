CREATE TABLE "trend_platform_stats" (
	"snapshot_id" integer NOT NULL,
	"data_date" date NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"open_roles" integer NOT NULL,
	"new_roles" integer NOT NULL,
	"new_since" date NOT NULL,
	"big_pay_roles" integer NOT NULL,
	"big_pay_min_hourly_usd" integer NOT NULL,
	CONSTRAINT "trend_platform_stats_snapshot_id_slug_pk" PRIMARY KEY("snapshot_id","slug")
);
--> statement-breakpoint
ALTER TABLE "trend_platform_stats" ADD CONSTRAINT "trend_platform_stats_snapshot_id_trend_snapshots_id_fk" FOREIGN KEY ("snapshot_id") REFERENCES "public"."trend_snapshots"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "trend_platform_stats_slug_date_idx" ON "trend_platform_stats" USING btree ("slug","data_date");