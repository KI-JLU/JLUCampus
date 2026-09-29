ALTER TABLE "component" ADD COLUMN "singleton" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "component" ADD COLUMN "secrets" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "component_singleton_type_uidx" ON "component" USING btree ("type") WHERE "component"."singleton" = true;