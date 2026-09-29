ALTER TABLE "dashboard_folder_item" DROP CONSTRAINT "dashboard_folder_item_tile_id_widget_id_pk";--> statement-breakpoint
ALTER TABLE "dashboard_folder_item" ALTER COLUMN "widget_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "dashboard_folder_item" ADD COLUMN "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL;--> statement-breakpoint
ALTER TABLE "dashboard_folder_item" ADD COLUMN "kind" text DEFAULT 'widget' NOT NULL;--> statement-breakpoint
ALTER TABLE "dashboard_folder_item" ADD COLUMN "title" text;--> statement-breakpoint
ALTER TABLE "dashboard_folder_item" ADD COLUMN "url" text;--> statement-breakpoint
ALTER TABLE "dashboard_folder_item" ADD COLUMN "icon" text;--> statement-breakpoint
ALTER TABLE "dashboard_tile" ADD COLUMN "url" text;--> statement-breakpoint
ALTER TABLE "dashboard_tile" ADD COLUMN "icon" text;--> statement-breakpoint
CREATE UNIQUE INDEX "dashboard_folder_item_tile_id_widget_id_uidx" ON "dashboard_folder_item" USING btree ("tile_id","widget_id");