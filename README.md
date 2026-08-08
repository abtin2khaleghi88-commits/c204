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

---

## TTS Entegrasyon Rehberi (TTS Integration Guide)

### Ses üretimi NEREDE yapılıyor? / Where is speech generated?

Tüm kod tabanında TTS'e giden **tek** nokta:

- **Dosya:** `src/lib/backend/tts-provider.server.ts`
- **Fonksiyon:** `synthesizeSpeech()` → içinde `callLocalTts()`
- Kendi motorunuzu bağlamak için **sadece `callLocalTts()` gövdesini** değiştirin.

Endpoint `.env` üzerinden ayarlanır (kod değişikliği gerekmez):

```
LOCAL_TTS_URL=http://localhost:5002/api/tts
```

`LOCAL_TTS_URL` tanımlı değilse `synthesizeSpeech()` `null` döner ve arayüz
geçici olarak tarayıcının `SpeechSynthesis` sesini kullanır. Kendi motorunuzu
bağladığınız anda bu fallback hiç çalışmaz.

### Desteklenen yanıt biçimleri

`callLocalTts()` iki biçimden birini döndürebilir; ikisi de desteklenir:

| Motorunuz ne döndürüyorsa | Dönüş değeri | İstemcide |
| --- | --- | --- |
| Ham ses (wav/mp3/ogg, binary/stream) | `{ audio: ArrayBuffer, contentType }` | blob olarak çalınır |
| JSON + base64 (`{ audio: "UklGR..." }`) | `{ base64: string, contentType }` | base64 olarak çalınır |

### Akış (data flow)

```text
Arayüz  →  speak()                       src/lib/assistant-client.ts
        →  POST /api/assistant {action:"tts"}   src/routes/api/assistant.ts
        →  synthesizeSpeech() → callLocalTts()  src/lib/backend/tts-provider.server.ts
        →  playAudioSource()                    src/lib/audio-player.ts
```

### Genel ses oynatıcı

- **Dosya:** `src/lib/audio-player.ts`
- `playAudioSource(source, { onLevels, onEnded })` — `Blob`, `ArrayBuffer`,
  base64/data-URL string veya `Response` (stream) kabul eder. Belirli bir TTS
  motoruna bağlı değildir.
- `playBrowserSpeech()` — yalnızca motor bağlı değilken kullanılan geçici fallback.

### Gerçek sese senkron dalga animasyonu

`playAudioSource()` Web Audio API'nin **AnalyserNode**'unu kullanır; her
animasyon karesinde 9 frekans bandının gerçek genliğini `0..1` aralığında
`onLevels` ile yayar. `src/components/assistant/VoiceWave.tsx` bu değerleri
doğrudan çubuk yüksekliğine ve avatar parıltısına uygular — sabit bir CSS
döngüsü yoktur, ses yükselip alçaldıkça animasyon buna tepki verir.
