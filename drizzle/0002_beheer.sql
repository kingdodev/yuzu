CREATE TYPE "public"."ai_mode" AS ENUM('off', 'draft', 'autopilot');--> statement-breakpoint
CREATE TYPE "public"."draft_status" AS ENUM('pending', 'used', 'discarded');--> statement-breakpoint
CREATE TYPE "public"."integration_kind" AS ENUM('mailgun', 'magento', 'ai');--> statement-breakpoint
CREATE TYPE "public"."integration_status" AS ENUM('not_configured', 'connected', 'error', 'demo');--> statement-breakpoint
CREATE TYPE "public"."knowledge_kind" AS ENUM('page', 'upload', 'note');--> statement-breakpoint
CREATE TYPE "public"."knowledge_status" AS ENUM('pending', 'indexed', 'excluded', 'failed');--> statement-breakpoint
CREATE TABLE "ai_drafts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"ticket_id" uuid NOT NULL,
	"body" text NOT NULL,
	"translation" text,
	"confidence" integer NOT NULL,
	"sources" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"status" "draft_status" DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_intent_settings" (
	"organization_id" uuid NOT NULL,
	"intent" text NOT NULL,
	"label" text NOT NULL,
	"mode" "ai_mode" DEFAULT 'draft' NOT NULL,
	"confidence_threshold" integer DEFAULT 90 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ai_intent_settings_organization_id_intent_pk" PRIMARY KEY("organization_id","intent")
);
--> statement-breakpoint
CREATE TABLE "integrations" (
	"organization_id" uuid NOT NULL,
	"kind" "integration_kind" NOT NULL,
	"status" "integration_status" DEFAULT 'not_configured' NOT NULL,
	"settings" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"last_checked_at" timestamp with time zone,
	"last_error" text,
	CONSTRAINT "integrations_organization_id_kind_pk" PRIMARY KEY("organization_id","kind")
);
--> statement-breakpoint
CREATE TABLE "knowledge_sources" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"shop_id" uuid NOT NULL,
	"kind" "knowledge_kind" NOT NULL,
	"title" text NOT NULL,
	"url" text,
	"status" "knowledge_status" DEFAULT 'pending' NOT NULL,
	"content_text" text DEFAULT '' NOT NULL,
	"content_hash" text,
	"last_crawled_at" timestamp with time zone,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"shop_id" uuid,
	"language" "language" NOT NULL,
	"name" text NOT NULL,
	"body" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "shops" ADD COLUMN "tone_of_voice" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "shops" ADD COLUMN "retention_days_tickets" integer DEFAULT 730 NOT NULL;--> statement-breakpoint
ALTER TABLE "shops" ADD COLUMN "retention_days_attachments" integer DEFAULT 180 NOT NULL;--> statement-breakpoint
ALTER TABLE "shops" ADD COLUMN "opening_hours" text DEFAULT 'ma–vr 9:00–17:00' NOT NULL;--> statement-breakpoint
ALTER TABLE "ai_drafts" ADD CONSTRAINT "ai_drafts_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_drafts" ADD CONSTRAINT "ai_drafts_ticket_id_tickets_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "public"."tickets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_intent_settings" ADD CONSTRAINT "ai_intent_settings_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "integrations" ADD CONSTRAINT "integrations_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "knowledge_sources" ADD CONSTRAINT "knowledge_sources_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "knowledge_sources" ADD CONSTRAINT "knowledge_sources_shop_id_shops_id_fk" FOREIGN KEY ("shop_id") REFERENCES "public"."shops"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "templates" ADD CONSTRAINT "templates_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "templates" ADD CONSTRAINT "templates_shop_id_shops_id_fk" FOREIGN KEY ("shop_id") REFERENCES "public"."shops"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ai_drafts_ticket_idx" ON "ai_drafts" USING btree ("ticket_id","created_at");--> statement-breakpoint
CREATE INDEX "knowledge_org_shop_idx" ON "knowledge_sources" USING btree ("organization_id","shop_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "knowledge_shop_url_uq" ON "knowledge_sources" USING btree ("shop_id","url");--> statement-breakpoint
CREATE INDEX "templates_org_idx" ON "templates" USING btree ("organization_id","language");