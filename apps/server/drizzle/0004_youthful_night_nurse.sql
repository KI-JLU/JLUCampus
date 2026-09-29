CREATE TABLE "folder_template" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"icon" text,
	"enabled" boolean DEFAULT true NOT NULL,
	"sort_order" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "folder_template_item" (
	"template_id" uuid NOT NULL,
	"widget_id" uuid NOT NULL,
	"position" integer NOT NULL,
	CONSTRAINT "folder_template_item_template_id_widget_id_pk" PRIMARY KEY("template_id","widget_id")
);
--> statement-breakpoint
ALTER TABLE "folder_template_item" ADD CONSTRAINT "folder_template_item_template_id_folder_template_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."folder_template"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "folder_template_item" ADD CONSTRAINT "folder_template_item_widget_id_widget_id_fk" FOREIGN KEY ("widget_id") REFERENCES "public"."widget"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "folder_template_enabled_sort_order_idx" ON "folder_template" USING btree ("enabled","sort_order");--> statement-breakpoint
CREATE INDEX "folder_template_item_widget_id_idx" ON "folder_template_item" USING btree ("widget_id");