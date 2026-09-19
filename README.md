# C204 — Yerel (Offline) Kişisel AI Asistanı

C204; tamamen yerel çalışabilen, modüler sağlayıcı mimarisine sahip, şeffaf
kullanım takibi yapan bir kişisel AI asistan arayüzüdür. Ücretli / tokene bağlı
hiçbir servis kullanılmaz; her dış bağımlılık ya kendi bilgisayarınızdaki bir
sunucudur ya da tarayıcının kendi ücretsiz API'sidir.

- Stack: TanStack Start + React + TypeScript + Tailwind CSS v4
- Tek backend ucu: `POST /api/assistant`
- Kalıcılık: `localStorage` (yeni veritabanı yok)

---

# 1. ÖZELLİK DÖKÜMÜ (mevcut durum)

## 1.1 Sohbet

| Özellik | Nerede | Not |
| --- | --- | --- |
| Akan (streaming) yanıt | `src/lib/assistant-client.ts` → `streamChat()`, `src/routes/api/assistant.ts` (`action:"chat"`) | SSE: `memory` → `delta` → `done` |
| Markdown + kod bloğu | `src/components/assistant/Markdown.tsx` | highlight.js, kod bloğu kopyalama |
| Mesaj aksiyonları | `src/components/assistant/MessageList.tsx` | kopyala, kullanıcı mesajını düzenle, yeniden üret |
| Konuşma listesi | `src/components/assistant/ConversationSidebar.tsx` | `localStorage`, tıklayınca açılır, yeniden adlandır/sil |
| Ctrl+Enter ile gönderim | `src/components/assistant/Composer.tsx` | Enter satır sonu, Ctrl+Enter gönder |
| Kısayollar | `src/routes/index.tsx` | Ctrl+K yeni sohbet, Ctrl+M hafıza, Ctrl+, ayarlar |
| Dosya ekleme | `Composer.tsx` | buton + sürükle-bırak, görsel önizleme, metin dosyası özeti prompt'a geçer |
| İptal | `index.tsx` (`AbortController`) | akış ortasında durdurulabilir |

## 1.2 AI katmanı

- **Tek merkezi nokta:** `src/lib/backend/ai-provider.server.ts`
  - `streamAssistantReply()` → `streamLocalAi()` (Ollama NDJSON akışı)
  - `generateAssistantReply()` → `callLocalAi()`
  - `createMockReply()` — yerel sunucu yapılandırılmadığında geçici demo yanıtı
- **Yapılandırma:** `src/config/local-stack.config.ts`
  ```
  LOCAL_AI_BASE_URL=http://localhost:11434   # Ollama
  LOCAL_AI_CHAT_PATH=/api/chat
  LOCAL_AI_MODEL=qwen3.5:4b
  ```
- `LOCAL_AI_BASE_URL` tanımlı değilse demo yanıt döner; panoda servis
  "yapılandırılmadı" olarak görünür (sahte kota gösterilmez).
- Başka bir API şekline geçmek için **yalnızca** `callLocalAi()` /
  `streamLocalAi()` gövdesi değişir.

## 1.3 Hafıza (kısa + uzun süreli, vektör tabanlı)

- **Tek giriş noktası:** `retrieveMemory()` — `src/lib/backend/memory-store.server.ts`
- **Kısa süreli:** son 2 konuşma özeti; sabit, küçük veri, arama yapılmaz.
- **Uzun süreli:** `embedText()` ile vektörleştirme + cosine benzerliği;
  **sadece top-K (varsayılan 4)** kayıt modele gider, `RELEVANCE_THRESHOLD`
  altındakiler hiç gösterilmez. "Tüm geçmişi prompt'a bas" yaklaşımı yoktur.
- **Embedding:** `src/lib/backend/memory-embeddings.server.ts` — saf JavaScript
  (Türkçe karakter normalizasyonu → tokenizasyon → FNV-1a hashing trick →
  256 boyutlu L2-normalize vektör). Dış API, model indirme, anahtar yok:
  %100 çevrimdışı, ücretsiz, kotasız.
- **Arayüz:** `MemoryPanel.tsx` (liste, arama, kategori filtresi, düzenle/sil,
  toplu silme), `MemoryHits.tsx` (her yanıtta kullanılan kayıtlar + % alaka skoru),
  `MemoryGraph.tsx` (canvas 2D güç-yönlendirmeli bağlantı haritası; zoom/pan,
  hover/tıklamada bağlantılı kayıtların vurgulanması).
- Tarama sırasında %50 opaklıkta "Güçlü hafıza taraması yapılıyor…" göstergesi.

## 1.4 TTS (sesli okuma)

- **Tek merkezi nokta:** `src/lib/backend/tts-provider.server.ts` →
  `synthesizeSpeech()` → `callLocalTts()`
- Sözleşme:
  ```
  POST http://localhost:8880/synthesize        # LOCAL_TTS_URL
  { "text": "...", "language": "tr" | "en" }
  → audio/wav | audio/mpeg | audio/ogg   (önerilen: 16-bit PCM WAV, 22050/24000 Hz, mono)
  → veya { "audio": "<base64>", "contentType": "audio/wav" }   ("audio_base64" / "data" de kabul)
  ```
- **Oynatıcı motordan bağımsız:** `src/lib/audio-player.ts` →
  `playAudioSource()`; `Blob`, `ArrayBuffer`, base64/data-URL veya `Response`
  (stream) kabul eder.
- **Gerçek sese senkron animasyon:** Web Audio `AnalyserNode`, 9 frekans bandının
  gerçek genliği `onLevels` ile yayılır; `VoiceWave.tsx` içindeki nabız atan halka
  bu değerlerle hareket eder (sabit döngü değil).
- **Yedek:** yerel sunucu kapalıysa backend `{ fallback: true }` döner ve
  (kullanıcı kapatmadıysa) tarayıcı `SpeechSynthesis`'i devreye girer —
  `speakWithBrowser()`. Bu **geçici önizleme yedeğidir**, robotik ses beklenir;
  panodan kapatılabilir ve kapalıysa hiç çağrılmaz.

## 1.5 STT (push-to-talk / basılı tutarak konuşma)

- **Tek merkezi nokta:** `src/lib/backend/stt-provider.server.ts` →
  `transcribeAudio()` → `callLocalStt()`
- Sözleşme:
  ```
  POST http://localhost:9000/transcribe       # LOCAL_STT_URL (yerel Whisper)
  multipart/form-data: file=<audio/webm|ogg|wav>, language="tr"|"en"
  → { "text": "..." }   ("transcript" / "transcription" / { result: { text } } de kabul)
  ```
- **Arayüz:** `src/hooks/use-push-to-talk.ts` — `MediaRecorder` + `AnalyserNode`;
  ayarlardan seçilen tuş (varsayılan Sağ Ctrl) basılı tutulduğu sürece kayıt,
  mikrofon butonunda fare/dokunma ile de aynı davranış; nabız atan kırmızı
  gösterge + **gerçek mikrofon genliğine** göre dalga.
- Bırakınca kayıt durur, metin **mesaj kutusuna yazılır — otomatik gönderilmez.**
- Boş/başarısız transkripsiyon gönderilmez; mikrofon izni reddi ve
  desteklenmeyen tarayıcı ayrı hata mesajlarıyla karşılanır.
- **Yedek:** yerel Whisper kapalıysa (ve izin verilmişse) tarayıcı
  `SpeechRecognition` sonucu kullanılır — yine geçici önizleme yedeği.

## 1.6 Kullanım & Limitler panosu (sağlayıcı yönetimi)

Sol menüdeki **Kullanım & Limitler** ve başlıktaki etkinlik butonu işlevsel bir
denetim masası açar (`src/components/assistant/UsagePanel.tsx`).

| Dosya | Rol |
| --- | --- |
| `src/lib/services/types.ts` | `ServiceDefinition`, `UsageSnapshot`, birim/dönem türleri |
| `src/lib/services/registry.ts` | Gerçek servislerin kaydı (sahte servis YOK) |
| `src/lib/services/usage-store.ts` | `localStorage: c204.usage.v1` — toggle, limit, sayaçlar, günlük/aylık reset |
| `src/lib/services/provider-manager.ts` | `selectProvider()` — yetenek → sağlayıcı → yapılandırma → erişim → kota |
| `src/lib/services/voice.ts` | `speakViaProviders()`, `planStt()`, kullanım kaydı |
| `src/routes/api/assistant.ts` (`action:"status"`) | yerel uçların gerçek erişilebilirlik taraması |

Kayıtlı servisler: `ai.ollama`, `ai.demo`, `stt.local`, `stt.browser`,
`tts.local`, `tts.browser`, `memory.embeddings`.

**Kurallar**

- **Kota uydurulmaz.** Sağlayıcı kalan kotayı bildirmiyorsa kart "yerel sayım"
  der; elle girilen limitler "kullanıcı tanımlı tahmin" etiketiyle gösterilir.
- **Kapalı sağlayıcı çağrılmaz.** Yetenek kapalıysa mikrofon hiç açılmaz;
  `speakViaProviders()` kapalı motoru atlar, yedeğe geçerse arayüzde bildirir.
- **Birimler servise göre:** AI = istek, TTS = karakter, STT = ses saniyesi,
  hafıza = vektörleştirme çağrısı.
- **Yerel AI için çevrimiçi kota yoktur;** sınır yerel donanım/model hızıdır —
  "sınırsız" iddiası yapılmaz.
- Modlar: otomatik / sadece yerel / elle (belirli sağlayıcı).

## 1.7 Arayüz, tema, dil

- HUD tarzı koyu tema: turkuaz vurgular, camsı paneller, ızgara zemin
  (`src/styles.css`); tipografi JetBrains Mono + başlıklarda Orbitron.
- Tema: `src/lib/theme.ts` — `light | dark | system`, kalıcı, sistem temasını takip eder.
- Dil: TR/EN — `src/lib/i18n.ts`, ayarlardan geçiş, tüm metinler iki dilde.
- Mobil: kenar çubuğu ve paneller `Sheet` olarak açılır.

## 1.8 REST sözleşmesi (tek uç)

```
POST /api/assistant
{ "action": "chat",   messages, language, useShortTerm, useLongTerm, attachments }  → SSE
{ "action": "tts",    text, language }        → audio/* | { audio } | { fallback: true }
{ "action": "stt",    audio, mimeType, language } → { text } | { fallback: true }
{ "action": "status", probe }                 → { availability, config }
{ "action": "memory.list" | "memory.search" | "memory.upsert"
           | "memory.delete" | "memory.deleteMany" | "memory.summarize" }
```

## 1.9 .env

```
LOCAL_AI_BASE_URL=http://localhost:11434
LOCAL_AI_CHAT_PATH=/api/chat
LOCAL_AI_MODEL=qwen3.5:4b
LOCAL_TTS_URL=http://localhost:8880/synthesize
LOCAL_TTS_TIMEOUT_MS=8000
LOCAL_STT_URL=http://localhost:9000/transcribe
LOCAL_STT_TIMEOUT_MS=15000
LOCAL_MEMORY_BASE_URL=http://localhost:8000
MEMORY_SHORT_TERM_COUNT=2
MEMORY_COLLECTION=local_assistant_memory
```

---

# 2. GELİŞTİRİLEBİLİR TARAFLAR (öneriler)

Sırayla, etki/emek dengesine göre:

1. **Hafıza kalıcılığı.** `memory-store.server.ts` şu an süreç belleğinde
   çalışıyor; sunucu yenilenince kayıtlar sıfırlanır. Chroma bağlantısını
   (`LOCAL_MEMORY_BASE_URL`) `searchLongTermMemory()` içinde tamamlamak veya
   basit bir JSON/SQLite dosyası yazmak en yüksek getirili adım.
2. **Daha güçlü embedding.** Hashing trick leksikaldir (eşanlamlıları kaçırır).
   Ollama `/api/embeddings` (örn. `nomic-embed-text`) tek fonksiyon değişikliğiyle
   bağlanabilir; ücretsiz ve yerel kalır. `embedText()` imzası aynı kalır.
3. **Otomatik konuşma özeti.** Kısa süreli hafıza şu an elle
   (`memory.summarize`) besleniyor; sohbet kapanınca modelden 2-3 cümlelik özet
   isteyip otomatik kaydetmek "daha fazla hatırla, daha az gönder" hedefini
   tamamlar.
4. **Streaming TTS.** Yanıt bittikten sonra okumak yerine cümle cümle
   sentezlemek (ilk cümle gelince okumaya başlamak) algılanan gecikmeyi büyük
   ölçüde düşürür; `playAudioSource()` zaten `Response` stream kabul ediyor.
5. **Yerel uç sağlığı için tek seferlik yeniden tarama.** `status` uçu OPTIONS
   ile yokluyor; bazı sunucular OPTIONS'a cevap vermez. Ollama için `/api/tags`
   gibi, TTS/STT için de hafif bir `GET /health` sözleşmesi tanımlanabilir.
6. **Konuşma arama.** Konuşma listesinde başlık/içerik araması ve tarihe göre
   gruplama (bugün / bu hafta / daha önce).
7. **Dışa/içe aktarma.** Konuşmaları ve hafıza kayıtlarını JSON olarak
   indirme/geri yükleme — yedekleme ve makine değiştirme için.
8. **Dosya ekleri.** Şu an yalnızca metin dosyalarının özeti prompt'a giriyor;
   PDF/DOCX metin çıkarımı ve uzun dosyalar için parçalama (chunking) +
   hafızaya alma eklenebilir.
9. **Model seçimi arayüzde.** `LOCAL_AI_MODEL` yalnızca `.env`'den geliyor;
   Ollama `/api/tags` listesinden arayüzde model seçmek pratik olur.
10. **Erişilebilirlik ve klavye.** Panellerde odak tuzağı, `aria-live` ile akan
    yanıtın ekran okuyucuya bildirilmesi, kısayolların keşfedilebilir listesi.
11. **Test.** Vitest ile `embedText`/`retrieveMemory` (top-K ve eşik davranışı) ve
    `selectProvider`/`planStt` (kapalı sağlayıcı asla seçilmez) için birim
    testleri — bu iki alan sistemin en kritik davranış sözleşmesi.
12. **Sohbet sanallaştırma.** Çok uzun konuşmalarda mesaj listesini
    sanallaştırmak (windowing) kaydırma performansını korur.

---

# 3. SON TARAMA NOTLARI

- `tsgo --noEmit`: hata yok.
- ESLint: tüm hatalar giderildi (kalan uyarılar yalnızca `src/components/ui/*`
  içindeki shadcn dosyalarının "fast refresh" bilgi notları).
- Düzeltildi: `planStt()` içinde "elle sağlayıcı" seçimi, yetenek kapalıyken de
  tarayıcı STT'sine izin verebiliyordu; artık yetenek kapalıysa hiçbir motor
  çalıştırılmıyor, `sadece yerel` modunda tarayıcı motoru devre dışı ve elle
  modda yalnızca seçilen sağlayıcı kullanılıyor.

---

## Geliştirme

```sh
npm i
npm run dev
```
