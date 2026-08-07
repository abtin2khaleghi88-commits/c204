# Welcome to your Lovable project

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Open your project in the [Lovable editor](https://lovable.dev) and keep building.

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: connect the project to GitHub and every change made in Lovable is committed straight to your repository.
- **Full ownership**: this code is yours. Push to your repository and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```

## Built with

- TanStack Start
- TypeScript
- React
- Tailwind CSS

---

## Yerel AI Asistan — Entegrasyon Rehberi (Integration Guide)

### AI çağrısı NEREDE yapılıyor? / Where is the AI called?

Tüm kod tabanında yapay zekaya giden **tek** nokta:

- **Dosya:** `src/lib/backend/ai-provider.server.ts`
- **Fonksiyon:** `generateAssistantReply()` → içinde `callLocalAi()`
- Geçici demo cevaplayıcı: aynı dosyadaki `createMockReply()` (silinmek üzere yazıldı)

Kendi yerel modelinizi bağlamak için `.env` dosyasına şunları ekleyin:

```
LOCAL_AI_BASE_URL=http://localhost:11434   # Ollama
LOCAL_AI_CHAT_PATH=/api/chat
LOCAL_AI_MODEL=llama3.1
LOCAL_TTS_URL=http://localhost:5002/api/tts
LOCAL_MEMORY_BASE_URL=http://localhost:8000  # Chroma
MEMORY_SHORT_TERM_COUNT=2
MEMORY_COLLECTION=local_assistant_memory
```

`LOCAL_AI_BASE_URL` tanımlıysa gerçek yerel sunucu kullanılır; tanımlı değilse demo yanıt döner.
Farklı bir API şekli kullanıyorsanız yalnızca `callLocalAi()` gövdesini değiştirin — başka dosyaya dokunmanız gerekmez.

### Mimari haritası

| Katman | Dosya | Görev |
| --- | --- | --- |
| Yapılandırma | `src/config/local-stack.config.ts` | Tüm endpoint/env ayarları (tek yer) |
| Backend giriş noktası | `src/routes/api/assistant.ts` | `POST /api/assistant` — tek REST ucu (`action` alanı ile) |
| AI | `src/lib/backend/ai-provider.server.ts` | **AI çağrısı burada** |
| TTS | `src/lib/backend/tts-provider.server.ts` | `synthesizeSpeech()`; yerel TTS yoksa tarayıcı sesi |
| Hafıza | `src/lib/backend/memory-store.server.ts` | Kısa/uzun süreli hafıza iskeleti + Chroma bağlantı noktası |
| Frontend istemci | `src/lib/assistant-client.ts` | `/api/assistant` sarmalayıcısı, TTS oynatma |

### REST sözleşmesi

```
POST /api/assistant
{ "action": "chat", "messages": [...], "language": "tr", "useShortTerm": false, "useLongTerm": true, "attachments": [...] }
{ "action": "tts", "text": "...", "language": "tr" }        // audio veya { fallback: true }
{ "action": "memory.list" }
{ "action": "memory.upsert", "record": { ... } }
{ "action": "memory.delete", "id": "..." }
```

### Hafıza sistemi bağlantı noktaları

- `buildMemoryContext()` → prompt'a eklenen hafıza metnini üretir.
- `searchLongTermMemory()` → içindeki `TODO` yorumuna Chroma sorgunuzu yazın.
- `listMemories() / upsertMemory() / deleteMemory()` → Hafıza Yönetimi panelini besler (arayüzde sol alt köşe).
- Hafıza taraması sırasında arayüzde %50 opaklıkta "Güçlü hafıza taraması yapılıyor..." göstergesi çıkar.

### Arayüz özellikleri

- Sol tarafta kutucuk halinde konuşma listesi (yerel `localStorage`).
- Klavye ile metin girişi (speech-to-text yok, bilinçli olarak eklenmedi).
- Dosya ekleme: buton + sürükle-bırak; metin dosyalarının içeriği prompt'a özet olarak geçer.
- Ayarlar: Türkçe/İngilizce geçişi, otomatik sesli okuma, hafıza tercihleri.
- AI konuşurken ses dalgası + parıltı animasyonu.
