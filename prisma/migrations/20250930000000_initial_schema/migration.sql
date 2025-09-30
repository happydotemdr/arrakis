-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "vector";

-- CreateEnum
CREATE TYPE "public"."Role" AS ENUM ('user', 'assistant', 'system', 'function', 'tool');

-- CreateTable
CREATE TABLE "public"."conversations" (
    "id" TEXT NOT NULL,
    "session_id" TEXT,
    "project_path" TEXT,
    "title" TEXT,
    "description" TEXT,
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ended_at" TIMESTAMP(3),
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "conversations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."messages" (
    "id" TEXT NOT NULL,
    "conversation_id" TEXT NOT NULL,
    "role" "public"."Role" NOT NULL,
    "content" TEXT NOT NULL,
    "tool_calls" JSONB,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."tool_uses" (
    "id" TEXT NOT NULL,
    "message_id" TEXT NOT NULL,
    "tool_name" TEXT NOT NULL,
    "parameters" JSONB,
    "response" JSONB,
    "duration" INTEGER,
    "status" TEXT,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tool_uses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."conversation_embeddings" (
    "id" TEXT NOT NULL,
    "conversation_id" TEXT NOT NULL,
    "chunk_text" TEXT NOT NULL,
    "chunk_index" INTEGER NOT NULL,
    "embedding" vector(1536),
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "conversation_embeddings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "conversations_session_id_idx" ON "public"."conversations"("session_id");

-- CreateIndex
CREATE INDEX "conversations_project_path_idx" ON "public"."conversations"("project_path");

-- CreateIndex
CREATE INDEX "conversations_started_at_idx" ON "public"."conversations"("started_at");

-- CreateIndex
CREATE INDEX "conversations_ended_at_idx" ON "public"."conversations"("ended_at");

-- CreateIndex
CREATE INDEX "messages_conversation_id_idx" ON "public"."messages"("conversation_id");

-- CreateIndex
CREATE INDEX "messages_role_idx" ON "public"."messages"("role");

-- CreateIndex
CREATE INDEX "messages_timestamp_idx" ON "public"."messages"("timestamp");

-- CreateIndex
CREATE INDEX "tool_uses_message_id_idx" ON "public"."tool_uses"("message_id");

-- CreateIndex
CREATE INDEX "tool_uses_tool_name_idx" ON "public"."tool_uses"("tool_name");

-- CreateIndex
CREATE INDEX "tool_uses_timestamp_idx" ON "public"."tool_uses"("timestamp");

-- CreateIndex
CREATE INDEX "tool_uses_status_idx" ON "public"."tool_uses"("status");

-- CreateIndex
CREATE INDEX "conversation_embeddings_conversation_id_idx" ON "public"."conversation_embeddings"("conversation_id");

-- CreateIndex
CREATE INDEX "conversation_embeddings_chunk_index_idx" ON "public"."conversation_embeddings"("chunk_index");

-- AddForeignKey
ALTER TABLE "public"."messages" ADD CONSTRAINT "messages_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."tool_uses" ADD CONSTRAINT "tool_uses_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "public"."messages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."conversation_embeddings" ADD CONSTRAINT "conversation_embeddings_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

