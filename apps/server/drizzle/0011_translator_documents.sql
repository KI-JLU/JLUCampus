CREATE TABLE "translator_document" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"component_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"filename" text NOT NULL,
	"size" integer NOT NULL,
	"source" text,
	"target" text NOT NULL,
	"formality" text NOT NULL,
	"status" text DEFAULT 'queued' NOT NULL,
	"seconds_remaining" integer,
	"error" text,
	"deepl_document_id" text NOT NULL,
	"deepl_document_key" text NOT NULL,
	"result" "bytea",
	"result_content_type" text,
	"deleted_at" timestamp,
	"poll_claimed_at" timestamp,
	"polled_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"expires_at" timestamp NOT NULL
);
--> statement-breakpoint
ALTER TABLE "translator_document" ADD CONSTRAINT "translator_document_component_id_component_id_fk" FOREIGN KEY ("component_id") REFERENCES "public"."component"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "translator_document" ADD CONSTRAINT "translator_document_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "translator_document_user_created_idx" ON "translator_document" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "translator_document_status_expires_idx" ON "translator_document" USING btree ("status","expires_at");--> statement-breakpoint
CREATE INDEX "translator_document_expires_idx" ON "translator_document" USING btree ("expires_at");