CREATE TABLE IF NOT EXISTS "embedding_processing_log" (
	"log_id" serial PRIMARY KEY NOT NULL,
	"item_type" varchar(20) NOT NULL,
	"item_id" varchar(100) NOT NULL,
	"operation" varchar(50) NOT NULL,
	"status" varchar(20) NOT NULL,
	"processing_time_ms" integer,
	"token_count" integer,
	"chunk_count" integer DEFAULT 1,
	"model" varchar(50),
	"error_message" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "embedding_queue" (
	"queue_id" serial PRIMARY KEY NOT NULL,
	"item_type" varchar(20) NOT NULL,
	"item_id" varchar(100) NOT NULL,
	"priority" integer DEFAULT 5 NOT NULL,
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"retry_count" integer DEFAULT 0 NOT NULL,
	"error_message" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"processed_at" timestamp with time zone,
	CONSTRAINT "embedding_queue_item_type_item_id_unique" UNIQUE("item_type","item_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "session_embeddings" (
	"session_embedding_id" serial PRIMARY KEY NOT NULL,
	"session_id" uuid NOT NULL,
	"summary_text" text NOT NULL,
	"embedding" text NOT NULL,
	"model" varchar(50) DEFAULT 'text-embedding-3-small' NOT NULL,
	"token_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "messages" ADD COLUMN "embedding_status" varchar(20) DEFAULT 'pending';--> statement-breakpoint
ALTER TABLE "sessions" ADD COLUMN "message_count" integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE "sessions" ADD COLUMN "embedding_status" varchar(20) DEFAULT 'pending';--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "session_embeddings" ADD CONSTRAINT "session_embeddings_session_id_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
