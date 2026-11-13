CREATE TABLE "trend_pay" (
	"snapshot_id" integer NOT NULL,
	"data_date" date NOT NULL,
	"slug" text NOT NULL,
	"label" text NOT NULL,
	"currency" text NOT NULL,
	"unit" text NOT NULL,
	"median" double precision NOT NULL,
	"typical_low" double precision NOT NULL,
	"typical_high" double precision NOT NULL,
	"rate_samples" integer NOT NULL,
	"platforms" integer NOT NULL,
	"open_total" integer,
	"unpriced" integer,
	CONSTRAINT "trend_pay_snapshot_id_slug_pk" PRIMARY KEY("snapshot_id","slug")
);
--> statement-breakpoint
CREATE TABLE "trend_platforms" (
	"snapshot_id" integer NOT NULL,
	"data_date" date NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"open_count" integer NOT NULL,
	CONSTRAINT "trend_platforms_snapshot_id_slug_pk" PRIMARY KEY("snapshot_id","slug")
);
--> statement-breakpoint
CREATE TABLE "trend_snapshots" (
	"id" serial PRIMARY KEY NOT NULL,
	"data_date" date NOT NULL,
	"file_kind" text NOT NULL,
	"source_url" text NOT NULL,
	"source_updated_at" timestamp with time zone,
	"raw_key" text NOT NULL,
	"sha256" text NOT NULL,
	"status" text NOT NULL,
	"hold_reason" text,
	"fetched_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "trend_totals" (
	"snapshot_id" integer PRIMARY KEY NOT NULL,
	"data_date" date NOT NULL,
	"open_roles" integer NOT NULL,
	"platforms_live" integer NOT NULL,
	"new_last_7d" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "trend_weekly" (
	"week_start" date PRIMARY KEY NOT NULL,
	"new_roles" integer NOT NULL,
	"as_of_date" date NOT NULL,
	"snapshot_id" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "trend_work_types" (
	"snapshot_id" integer NOT NULL,
	"data_date" date NOT NULL,
	"slug" text NOT NULL,
	"label" text NOT NULL,
	"open_count" integer NOT NULL,
	"currency" text,
	"unit" text,
	"median" double precision,
	"typical_low" double precision,
	"typical_high" double precision,
	"rate_samples" integer,
	"platforms" integer,
	CONSTRAINT "trend_work_types_snapshot_id_slug_pk" PRIMARY KEY("snapshot_id","slug")
);
--> statement-breakpoint
ALTER TABLE "trend_pay" ADD CONSTRAINT "trend_pay_snapshot_id_trend_snapshots_id_fk" FOREIGN KEY ("snapshot_id") REFERENCES "public"."trend_snapshots"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trend_platforms" ADD CONSTRAINT "trend_platforms_snapshot_id_trend_snapshots_id_fk" FOREIGN KEY ("snapshot_id") REFERENCES "public"."trend_snapshots"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trend_totals" ADD CONSTRAINT "trend_totals_snapshot_id_trend_snapshots_id_fk" FOREIGN KEY ("snapshot_id") REFERENCES "public"."trend_snapshots"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trend_weekly" ADD CONSTRAINT "trend_weekly_snapshot_id_trend_snapshots_id_fk" FOREIGN KEY ("snapshot_id") REFERENCES "public"."trend_snapshots"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trend_work_types" ADD CONSTRAINT "trend_work_types_snapshot_id_trend_snapshots_id_fk" FOREIGN KEY ("snapshot_id") REFERENCES "public"."trend_snapshots"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "trend_pay_slug_date_idx" ON "trend_pay" USING btree ("slug","data_date");--> statement-breakpoint
CREATE INDEX "trend_platforms_slug_date_idx" ON "trend_platforms" USING btree ("slug","data_date");--> statement-breakpoint
CREATE UNIQUE INDEX "trend_snapshots_date_kind_uq" ON "trend_snapshots" USING btree ("data_date","file_kind");--> statement-breakpoint
CREATE INDEX "trend_work_types_slug_date_idx" ON "trend_work_types" USING btree ("slug","data_date");