CREATE TABLE "layout_preset" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"audience_kind" text NOT NULL,
	"audience_name" text,
	"sort_order" integer NOT NULL,
	"sidebar" jsonb NOT NULL,
	"dashboard" jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "keycloak_roles" text[] DEFAULT '{}'::text[] NOT NULL;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "keycloak_groups" text[] DEFAULT '{}'::text[] NOT NULL;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "layout_initialized_at" timestamp;--> statement-breakpoint
UPDATE "user" SET "layout_initialized_at" = now();--> statement-breakpoint
CREATE INDEX "layout_preset_sort_order_idx" ON "layout_preset" USING btree ("sort_order");--> statement-breakpoint
CREATE UNIQUE INDEX "layout_preset_everyone_uidx" ON "layout_preset" USING btree ("audience_kind") WHERE "layout_preset"."audience_kind" = 'everyone';
