CREATE TABLE "feed_read" (
	"user_id" text NOT NULL,
	"feed_url" text NOT NULL,
	"read_at" timestamp NOT NULL,
	CONSTRAINT "feed_read_user_id_feed_url_pk" PRIMARY KEY("user_id","feed_url")
);
--> statement-breakpoint
ALTER TABLE "feed_read" ADD CONSTRAINT "feed_read_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;