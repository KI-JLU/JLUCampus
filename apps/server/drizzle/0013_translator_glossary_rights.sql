ALTER TABLE "translator_glossary" ADD COLUMN "category" text DEFAULT 'general' NOT NULL;--> statement-breakpoint
ALTER TABLE "translator_glossary" ADD COLUMN "visible_to" text;--> statement-breakpoint
ALTER TABLE "translator_glossary" ADD COLUMN "editor_role" text;