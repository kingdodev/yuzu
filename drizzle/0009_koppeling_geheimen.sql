ALTER TABLE "integrations" ADD COLUMN "secrets" text;--> statement-breakpoint
ALTER TABLE "integrations" ADD COLUMN "updated_at" timestamp with time zone DEFAULT now() NOT NULL;