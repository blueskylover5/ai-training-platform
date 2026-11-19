CREATE TABLE "site_visits" (
	"id" serial PRIMARY KEY NOT NULL,
	"visited_at" timestamp with time zone DEFAULT now() NOT NULL,
	"path" text NOT NULL,
	"ip" text,
	"country" text,
	"region" text,
	"city" text,
	"user_agent" text,
	"referrer" text
);
--> statement-breakpoint
CREATE INDEX "site_visits_visited_at_idx" ON "site_visits" USING btree ("visited_at");--> statement-breakpoint
CREATE INDEX "site_visits_ip_visited_at_idx" ON "site_visits" USING btree ("ip","visited_at");