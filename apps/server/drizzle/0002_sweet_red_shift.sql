CREATE TABLE "dashboard_folder_item" (
	"tile_id" uuid NOT NULL,
	"widget_id" uuid NOT NULL,
	"position" integer NOT NULL,
	CONSTRAINT "dashboard_folder_item_tile_id_widget_id_pk" PRIMARY KEY("tile_id","widget_id")
);
--> statement-breakpoint
ALTER TABLE "dashboard_tile" ALTER COLUMN "widget_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "dashboard_tile" ADD COLUMN "kind" text DEFAULT 'widget' NOT NULL;--> statement-breakpoint
ALTER TABLE "dashboard_tile" ADD COLUMN "title" text;--> statement-breakpoint
ALTER TABLE "dashboard_folder_item" ADD CONSTRAINT "dashboard_folder_item_tile_id_dashboard_tile_id_fk" FOREIGN KEY ("tile_id") REFERENCES "public"."dashboard_tile"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dashboard_folder_item" ADD CONSTRAINT "dashboard_folder_item_widget_id_widget_id_fk" FOREIGN KEY ("widget_id") REFERENCES "public"."widget"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "dashboard_folder_item_widget_id_idx" ON "dashboard_folder_item" USING btree ("widget_id");