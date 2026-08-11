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
LOCAL_TTS_URL=http://localhost:8880/synthesize
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
| TTS | `src/lib/backend/tts-provider.server.ts` | `synthesizeSpeech()` → yalnızca yerel sunucu (ücretli sağlayıcı yok) |
| Hafıza | `src/lib/backend/memory-store.server.ts` | Kısa/uzun süreli hafıza iskeleti + Chroma bağlantı noktası |
| Frontend istemci | `src/lib/assistant-client.ts` | `/api/assistant` sarmalayıcısı, TTS oynatma |

### REST sözleşmesi

```
POST /api/assistant
{ "action": "chat", "messages": [...], "language": "tr", "useShortTerm": false, "useLongTerm": true, "attachments": [...] }
{ "action": "tts", "text": "...", "language": "tr" }        // audio/* , { audio: base64 } veya { fallback: true }
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

### Kural: ucretli/tokene bagli hicbir saglayici yok

Bu projede **ucretli veya token bazli hicbir TTS servisi kullanilmaz.**
Lovable AI Gateway (`openai/gpt-4o-mini-tts`), ElevenLabs, Azure ve Google
entegrasyonlari **tamamen kaldirildi**. Tek hedef motor, sizin kendi
bilgisayarinizda calisan yerel TTS sunucunuzdur.

```
LOCAL_TTS_URL=http://localhost:8880/synthesize   # varsayilan
LOCAL_TTS_TIMEOUT_MS=8000                        # opsiyonel
```

### Ses üretimi NEREDE yapılıyor? / Where is speech generated?

Tum kod tabaninda TTS'e giden **tek** nokta:

- **Dosya:** `src/lib/backend/tts-provider.server.ts`
- **Merkezi fonksiyon:** `synthesizeSpeech()`
- **Degistireceginiz fonksiyon:** `callLocalTts()` — istek/yanit sekli burada

Kendi API sekliniz farkliysa (govde alanlari, header'lar, GET/POST) **sadece**
`callLocalTts()` govdesini degistirin. Baska hicbir dosyaya dokunmaniz gerekmez.

### Yerel sunucunuzun uygulamasi gereken sozlesme

**Istek**

```
POST http://localhost:8880/synthesize
Content-Type: application/json

{ "text": "okunacak metin", "language": "tr" }     // language: "tr" | "en"
```

**Yanit A — onerilen: ham ses baytlari**

```
200 OK
Content-Type: audio/wav        # audio/mpeg veya audio/ogg de olur
<binary audio>
```

**Yanit B — JSON + base64**

```
200 OK
Content-Type: application/json

{ "audio": "<base64>", "contentType": "audio/wav" }
```

`audio` yerine `audio_base64` veya `data` alan adlari da kabul edilir.
`contentType` verilmezse `audio/wav` varsayilir.

**Hata**

```
4xx / 5xx + kisa metin govdesi
```

**Onerilen ses formati:** 16-bit PCM WAV, 22050 Hz veya 24000 Hz, **mono**.
(mp3/ogg da calisir; WAV en hizli decode edilir.)

### GECICI onizleme yedegi (gercek sistemde kullanilmaz)

Yerel sunucu henuz ayakta degilse backend hata firlatmak yerine
`{ fallback: true }` doner ve arayuz **sessizce** tarayici ici
`SpeechSynthesis` ile okur:

- **Dosya:** `src/lib/assistant-client.ts` → `previewFallbackSpeak()`
- Bu yol **yalnizca gelistirme/onizleme** icindir; robotik ses beklenir.
- Yerel motorunuz baglandigi anda bu yol hic cagrilmaz ve fonksiyon
  guvenle silinebilir. Uretim/gercek sistemde kullanilmaz.

### Akış (data flow)

```text
Arayüz  →  speak()                       src/lib/assistant-client.ts
        →  POST /api/assistant {action:"tts"}   src/routes/api/assistant.ts
        →  synthesizeSpeech() → callLocalTts()  src/lib/backend/tts-provider.server.ts
        →  playAudioSource()                    src/lib/audio-player.ts
        (sunucu kapali ise: previewFallbackSpeak() — gecici)
```

### Genel ses oynatıcı

- **Dosya:** `src/lib/audio-player.ts`
- `playAudioSource(source, { onLevels, onEnded })` — `Blob`, `ArrayBuffer`,
  base64/data-URL string veya `Response` (stream) kabul eder. Hicbir TTS
  motoruna bagli degildir.

### Gerçek sese senkron dalga animasyonu

`playAudioSource()` Web Audio API'nin **AnalyserNode**'unu kullanir; her
animasyon karesinde 9 frekans bandinin gercek genligini `0..1` araliginda
`onLevels` ile yayar. `src/components/assistant/VoiceWave.tsx` bu degerleri
dogrudan cubuk yuksekligine ve avatar parıltısına uygular. (Gecici tarayici
yedeginde gercek genlik olmadigi icin dusuk yogunluklu bir gosterge kullanilir.)

---

## Tema / Dark Mode

- **Dosya:** `src/lib/theme.ts` — `light | dark | system` modlari, `localStorage`
  ile kalici, `system` modunda isletim sistemi temasini otomatik takip eder.
- Hizli gecis: sohbet basligindaki gunes/ay butonu. Detayli secim: Ayarlar > Tema.
- Renkler `src/styles.css` icindeki `:root` ve `.dark` token'larindan gelir;
  ikisi de mavi tonlu, yumusak kontrastli olacak sekilde ayarlandi.

## Hafıza Entegrasyon Rehberi (vektör tabanlı)

Tüm hafıza erişimi TEK fonksiyondan geçer:

- `retrieveMemory()` — `src/lib/backend/memory-store.server.ts`
  - "tüm metni oku" DEĞİL: kısa süreli hafıza sabit/küçük veri (son 2 konuşma özeti, arama yapılmaz),
    uzun süreli hafıza embedding + cosine benzerliği ile **sadece top-K (varsayılan 4)** kaydı getirir;
    `RELEVANCE_THRESHOLD` altındaki hiçbir kayıt modele gösterilmez.
- `searchLongTermMemory()` — Chroma/kendi vektör DB'nizi bağlayacağınız yer (aynı şekilde sadece top-K dönün).
- `embedText()` — `src/lib/backend/memory-embeddings.server.ts`; ücretsiz, sınırsız, tamamen çevrimdışı
  hashing-trick embedding. Kendi embedding modelinizi (örn. Ollama `/api/embeddings`) bağlamak için
  yalnızca bu fonksiyonun gövdesini değiştirin.

Arayüz, her yanıtta hangi kayıtların kullanıldığını ve alaka skorunu (%) gösterir; Hafıza Yönetimi
panelinde arama, kategori filtresi, toplu silme ve kayıtlar arası bağlantı haritası (graph) bulunur.
