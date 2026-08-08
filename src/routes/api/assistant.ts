/**
 * ============================================================================
 * BACKEND KATMANI - TEK GIRIS NOKTASI / SINGLE BACKEND ENTRY POINT
 * ============================================================================
 * Frontend'in konustugu TEK REST ucu: POST /api/assistant
 * Govdede `action` alani ile islem secilir:
 *
 *   { action: "chat",          messages, language, useShortTerm, useLongTerm, attachments }
 *   { action: "tts",           text, language }              -> audio veya {fallback:true}
 *   { action: "memory.list"    }
 *   { action: "memory.upsert", record }
 *   { action: "memory.delete", id }
 *
 * AI / TTS / hafiza baglantilari bu dosyada DEGIL, su modullerde:
 *   src/lib/backend/ai-provider.server.ts     <- AI cagrisi
 *   src/lib/backend/tts-provider.server.ts    <- TTS cagrisi
 *   src/lib/backend/memory-store.server.ts    <- hafiza
 *   src/config/local-stack.config.ts          <- tum endpoint/env ayarlari
 * ============================================================================
 */

import { createFileRoute } from "@tanstack/react-router";

type Body = Record<string, unknown>;

export const Route = createFileRoute("/api/assistant")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const body = (await request.json().catch(() => ({}))) as Body;
        const action = String(body["action"] ?? "");
        const language = body["language"] === "en" ? "en" : "tr";

        const { generateAssistantReply } = await import("@/lib/backend/ai-provider.server");
        const { synthesizeSpeech } = await import("@/lib/backend/tts-provider.server");
        const memory = await import("@/lib/backend/memory-store.server");

        try {
          switch (action) {
            case "chat": {
              const messages = Array.isArray(body["messages"])
                ? (body["messages"] as { role: "user" | "assistant"; content: string }[])
                : [];
              const useShortTerm = Boolean(body["useShortTerm"]);
              const useLongTerm = Boolean(body["useLongTerm"]);
              const attachments = Array.isArray(body["attachments"])
                ? (body["attachments"] as { name: string; excerpt: string }[])
                : [];

              const lastUser = [...messages].reverse().find((m) => m.role === "user");
              const memoryContext =
                useShortTerm || useLongTerm
                  ? await memory.buildMemoryContext({
                      query: lastUser?.content ?? "",
                      useShortTerm,
                      useLongTerm,
                    })
                  : "";

              const reply = await generateAssistantReply({
                messages,
                language,
                memoryContext,
                attachments,
              });

              return Response.json({
                content: reply.content,
                source: reply.source,
                usedMemory: Boolean(memoryContext),
              });
            }

            case "tts": {
              const text = String(body["text"] ?? "").slice(0, 4000);
              const result = await synthesizeSpeech({ text, language });
              if ("base64" in result) {
                return Response.json({ audio: result.base64, contentType: result.contentType });
              }
              return new Response(result.audio, {
                headers: { "Content-Type": result.contentType },
              });
            }


            case "memory.list":
              return Response.json({ records: memory.listMemories() });

            case "memory.upsert":
              return Response.json({
                record: memory.upsertMemory((body["record"] ?? {}) as Body),
              });

            case "memory.delete":
              memory.deleteMemory(String(body["id"] ?? ""));
              return Response.json({ ok: true });

            default:
              return Response.json({ error: `Unknown action: ${action}` }, { status: 400 });
          }
        } catch (error) {
          console.error("[api/assistant]", error);
          return Response.json({ error: String(error) }, { status: 500 });
        }
      },
    },
  },
});
