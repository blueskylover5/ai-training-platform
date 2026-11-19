CREATE TABLE "trend_raw_files" (
	"key" text PRIMARY KEY NOT NULL,
	"body" text NOT NULL,
	"stored_at" timestamp with time zone DEFAULT now() NOT NULL
);
