ALTER TABLE "widget" RENAME TO "component";--> statement-breakpoint
ALTER TABLE "dashboard_folder_item" RENAME COLUMN "widget_id" TO "component_id";--> statement-breakpoint
ALTER TABLE "dashboard_tile" RENAME COLUMN "widget_id" TO "component_id";--> statement-breakpoint
ALTER TABLE "folder_template_item" RENAME COLUMN "widget_id" TO "component_id";--> statement-breakpoint
ALTER TABLE "sidebar_entry" RENAME COLUMN "widget_id" TO "component_id";--> statement-breakpoint
ALTER TABLE "dashboard_folder_item" ADD COLUMN "widget_key" text;--> statement-breakpoint
ALTER TABLE "dashboard_tile" ADD COLUMN "widget_key" text;--> statement-breakpoint
ALTER TABLE "folder_template_item" ADD COLUMN "widget_key" text;--> statement-breakpoint
UPDATE "dashboard_folder_item" AS "item"
SET "widget_key" = CASE "component"."type"
  WHEN 'iframe' THEN 'launcher'
  WHEN 'rss' THEN 'feed'
  WHEN 'link' THEN 'shortcut'
END
FROM "component"
WHERE "item"."kind" = 'widget'
  AND "item"."component_id" = "component"."id";--> statement-breakpoint
UPDATE "dashboard_tile" AS "tile"
SET "widget_key" = CASE "component"."type"
  WHEN 'iframe' THEN 'launcher'
  WHEN 'rss' THEN 'feed'
  WHEN 'link' THEN 'shortcut'
END
FROM "component"
WHERE "tile"."kind" = 'widget'
  AND "tile"."component_id" = "component"."id";--> statement-breakpoint
UPDATE "folder_template_item" AS "item"
SET "widget_key" = CASE "component"."type"
  WHEN 'iframe' THEN 'launcher'
  WHEN 'rss' THEN 'feed'
  WHEN 'link' THEN 'shortcut'
END
FROM "component"
WHERE "item"."component_id" = "component"."id";--> statement-breakpoint
ALTER TABLE "folder_template_item" ALTER COLUMN "widget_key" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "dashboard_folder_item" RENAME CONSTRAINT "dashboard_folder_item_widget_id_widget_id_fk" TO "dashboard_folder_item_component_id_component_id_fk";--> statement-breakpoint
ALTER TABLE "dashboard_tile" RENAME CONSTRAINT "dashboard_tile_widget_id_widget_id_fk" TO "dashboard_tile_component_id_component_id_fk";--> statement-breakpoint
ALTER TABLE "folder_template_item" RENAME CONSTRAINT "folder_template_item_widget_id_widget_id_fk" TO "folder_template_item_component_id_component_id_fk";--> statement-breakpoint
ALTER TABLE "sidebar_entry" RENAME CONSTRAINT "sidebar_entry_widget_id_widget_id_fk" TO "sidebar_entry_component_id_component_id_fk";--> statement-breakpoint
DROP INDEX "dashboard_folder_item_tile_id_widget_id_uidx";--> statement-breakpoint
CREATE UNIQUE INDEX "dashboard_folder_item_tile_id_component_id_widget_key_uidx" ON "dashboard_folder_item" USING btree ("tile_id","component_id","widget_key");--> statement-breakpoint
ALTER INDEX "dashboard_folder_item_widget_id_idx" RENAME TO "dashboard_folder_item_component_id_idx";--> statement-breakpoint
ALTER INDEX "dashboard_tile_widget_id_idx" RENAME TO "dashboard_tile_component_id_idx";--> statement-breakpoint
ALTER INDEX "folder_template_item_widget_id_idx" RENAME TO "folder_template_item_component_id_idx";--> statement-breakpoint
ALTER INDEX "sidebar_entry_widget_id_idx" RENAME TO "sidebar_entry_component_id_idx";--> statement-breakpoint
ALTER INDEX "widget_enabled_sort_order_idx" RENAME TO "component_enabled_sort_order_idx";--> statement-breakpoint
ALTER TABLE "folder_template_item" DROP CONSTRAINT "folder_template_item_template_id_widget_id_pk";--> statement-breakpoint
ALTER TABLE "folder_template_item" ADD CONSTRAINT "folder_template_item_template_id_component_id_widget_key_pk" PRIMARY KEY("template_id","component_id","widget_key");--> statement-breakpoint
ALTER TABLE "sidebar_entry" RENAME CONSTRAINT "sidebar_entry_user_id_widget_id_pk" TO "sidebar_entry_user_id_component_id_pk";--> statement-breakpoint
ALTER TABLE "component" RENAME CONSTRAINT "widget_pkey" TO "component_pkey";--> statement-breakpoint
ALTER TABLE "component" DROP COLUMN "min_w";--> statement-breakpoint
ALTER TABLE "component" DROP COLUMN "min_h";
