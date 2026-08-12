/**
 * ============================================================================
 * BACKEND KATMANI - TEK GIRIS NOKTASI / SINGLE BACKEND ENTRY POINT
 * ============================================================================
 * Frontend'in konustugu TEK REST ucu: POST /api/assistant
 * Govdede `action` alani ile islem secilir:
 *
 *   { action: "chat",           ... }  -> SSE akisi (memory -> delta -> done)
 *   { action: "tts",            text, language }
 *   { action: "memory.list"     }      -> { records, links, categories }
 *   { action: "memory.upsert",  record }
 *   { action: "memory.delete",  id }
 *   { action: "memory.deleteMany", ids }
 *   { action: "memory.search",  query }   -> sadece top-K alakali kayit
 *
 * Entegrasyon noktalari:
 *   src/lib/backend/ai-provider.server.ts     <- AI cagrisi (callLocalAi / stream)
 *   src/lib/backend/tts-provider.server.ts    <- TTS cagrisi (synthesizeSpeech)
 *   src/lib/backend/memory-store.server.ts    <- hafiza (retrieveMemory)
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

        const memory = await import("@/lib/backend/memory-store.server");

        try {
          switch (action) {
            case "chat": {
              const { streamAssistantReply } = await import(
                "@/lib/backend/ai-provider.server"
              );

              const messages = Array.isArray(body["messages"])
                ? (body["messages"] as { role: "user" | "assistant"; content: string }[])
                : [];
              const useShortTerm = Boolean(body["useShortTerm"]);
              const useLongTerm = Boolean(body["useLongTerm"]);
              const attachments = Array.isArray(body["attachments"])
                ? (body["attachments"] as { name: string; excerpt: string }[])
                : [];

              const lastUser = [...messages].reverse().find((m) => m.role === "user");

              // >>> HAFIZA: tek merkezi cagri, "tum metni oku" DEGIL top-K getir.
              const retrieved =
                useShortTerm || useLongTerm
                  ? await memory.retrieveMemory({
                      query: lastUser?.content ?? "",
                      useShortTerm,
                      useLongTerm,
                    })
                  : null;

              const encoder = new TextEncoder();
              const stream = new ReadableStream<Uint8Array>({
                async start(controller) {
                  const send = (payload: unknown) =>
                    controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`));

                  send({
                    type: "memory",
                    hits: retrieved?.hits ?? [],
                    scanned: retrieved?.scanned ?? 0,
                    tookMs: retrieved?.tookMs ?? 0,
                  });

                  let source: "local" | "mock" = "mock";
                  try {
                    for await (const chunk of streamAssistantReply({
                      messages,
                      language,
                      memoryContext: retrieved?.context ?? "",
                      attachments,
                    })) {
                      if (chunk.delta) send({ type: "delta", text: chunk.delta });
                      if (chunk.source) source = chunk.source;
                    }
                  } catch (error) {
                    send({ type: "error", message: String(error) });
                  }

                  send({ type: "done", source, usedMemory: Boolean(retrieved?.context) });
                  controller.close();
                },
              });

              return new Response(stream, {
                headers: {
                  "Content-Type": "text/event-stream",
                  "Cache-Control": "no-cache, no-transform",
                  Connection: "keep-alive",
                },
              });
            }

            case "tts": {
              const { synthesizeSpeech } = await import("@/lib/backend/tts-provider.server");
              const text = String(body["text"] ?? "").slice(0, 4000);
              const result = await synthesizeSpeech({ text, language });
              // Yerel TTS sunucusu kapali -> istemci GECICI tarayici sesine duser.
              if ("unavailable" in result) {
                console.warn("[api/assistant] tts fallback:", result.reason);
                return Response.json({ fallback: true, reason: result.reason });
              }
              if ("base64" in result) {
                return Response.json({ audio: result.base64, contentType: result.contentType });
              }
              return new Response(result.audio, {
                headers: { "Content-Type": result.contentType },
              });
            }

            case "stt": {
              const { transcribeAudio } = await import("@/lib/backend/stt-provider.server");
              const result = await transcribeAudio({
                audioBase64: String(body["audio"] ?? ""),
                mimeType: String(body["mimeType"] ?? "audio/webm"),
                language,
              });
              // Yerel Whisper sunucusu kapali -> istemci GECICI tarayici
              // ses tanimasina duser (previewFallbackSpeak ile ayni mantik).
              if ("unavailable" in result) {
                console.warn("[api/assistant] stt fallback:", result.reason);
                return Response.json({ fallback: true, reason: result.reason });
              }
              return Response.json({ text: result.text });
            }


            case "memory.list": {
              const records = memory.listMemories();
              return Response.json({
                records,
                links: memory.memoryGraphLinks(),
                categories: [...new Set(records.map((record) => record.category))],
              });
            }

            case "memory.search": {
              const hits = await memory.searchLongTermMemory(String(body["query"] ?? ""));
              return Response.json({ hits });
            }

            case "memory.upsert":
              return Response.json({
                record: memory.upsertMemory((body["record"] ?? {}) as Body),
              });

            case "memory.delete":
              memory.deleteMemory(String(body["id"] ?? ""));
              return Response.json({ ok: true });

            case "memory.deleteMany": {
              const ids = Array.isArray(body["ids"]) ? (body["ids"] as string[]) : [];
              return Response.json({ removed: memory.deleteMemories(ids) });
            }

            case "memory.summarize":
              return Response.json({
                record: memory.rememberConversationSummary(String(body["summary"] ?? "")),
              });

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
