CREATE TABLE "contact_messages" (
	"id" serial PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"name" text,
	"email" text NOT NULL,
	"topic" text NOT NULL,
	"message" text NOT NULL,
	"policy_confirmed_at" timestamp with time zone NOT NULL,
	"address_hash" text NOT NULL,
	"status" text DEFAULT 'new' NOT NULL
);
--> statement-breakpoint
CREATE INDEX "contact_messages_address_created_idx" ON "contact_messages" USING btree ("address_hash","created_at");