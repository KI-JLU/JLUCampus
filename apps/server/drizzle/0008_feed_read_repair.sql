-- 0007_feed_read carries an older timestamp than 0006_layout_presets, so the
-- migrator skipped it on databases that already had 0006. Create the table
-- here if it is still missing; on databases that ran 0007 this does nothing.
CREATE TABLE IF NOT EXISTS "feed_read" (
	"user_id" text NOT NULL,
	"feed_url" text NOT NULL,
	"read_at" timestamp NOT NULL,
	CONSTRAINT "feed_read_user_id_feed_url_pk" PRIMARY KEY("user_id","feed_url")
);
--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "feed_read" ADD CONSTRAINT "feed_read_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
	WHEN duplicate_object THEN null;
END $$;
