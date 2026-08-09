# Ücretli TTS'i kaldır, yerel motora geç

Sistemde varsayılan olarak aktif hiçbir ücretli/tokene bağlı sağlayıcı kalmayacak. Tek hedef: sizin kendi bilgisayarınızda çalışan yerel TTS sunucusu. Yerel sunucu kapalıyken önizlemede sadece geçici bir tarayıcı sesi yedeği devreye girecek.

## Yapılacaklar

1. **Ücretli sağlayıcıları sil**
   - `src/lib/backend/tts-provider.server.ts`: `callLovableTts`, `callElevenLabsTts`, `callAzureTts`, `callGoogleTts` fonksiyonları ve seçim mantığındaki case'leri kaldırılır. Geriye tek motor kalır: `callLocalTts()`.
   - `src/config/local-stack.config.ts`: `tts` yapılandırması sadeleşir — `provider: "local"` sabit, `url` (varsayılan `http://localhost:8880/synthesize`) ve dil/ses opsiyonları. ElevenLabs/Azure/Google/Lovable anahtar alanları tamamen çıkar.
   - `LOVABLE_API_KEY` hiçbir TTS yolunda okunmaz.

2. **Varsayılan yerel endpoint**
   - `LOCAL_TTS_URL` tanımsızsa varsayılan `http://localhost:8880/synthesize`. `synthesizeSpeech({ text, language })` imzası ve dönüş tipi (`{ audio, contentType }` veya `{ base64, contentType }`) aynı kalır.

3. **Sessiz önizleme yedeği (yalnızca geliştirme)**
   - Sunucu tarafı yerel endpoint'e ulaşamazsa (bağlantı hatası/timeout) hata fırlatmak yerine `{ fallback: true, reason }` JSON döner; UI'da hata toast'ı gösterilmez.
   - `src/lib/assistant-client.ts` içindeki `speak()` bu yanıtı görünce tarayıcı `SpeechSynthesis` ile okur. Dalga animasyonu gerçek genlik veremediği için bu modda hafif, düşük yoğunluklu bir "konuşuyor" göstergesi kullanılır (animasyon altyapısı `playAudioSource` için değişmeden kalır).
   - Yedek yol açıkça `previewFallbackSpeak()` adıyla tek fonksiyonda toplanır ve "üretimde kullanılmaz" yorumuyla işaretlenir.

4. **README — "TTS Entegrasyon Rehberi" yeniden yazılır**
   - Ücretli motor tabloları silinir.
   - Yerel sunucunun beklenen sözleşmesi net yazılır:
     - `POST http://localhost:8880/synthesize`
     - İstek: `Content-Type: application/json`, gövde `{ "text": "...", "language": "tr" | "en" }`
     - Yanıt A (önerilen): ham ses baytları, `Content-Type: audio/wav` (veya `audio/mpeg`, `audio/ogg`)
     - Yanıt B: `application/json` + `{ "audio": "<base64>", "contentType": "audio/wav" }` (`audio_base64` / `data` alan adları da kabul edilir)
     - Hata: 4xx/5xx + kısa metin gövdesi
     - Önerilen format: 16-bit PCM WAV, 22.05 kHz veya 24 kHz, mono
   - `.env` bölümünde tek değişken kalır: `LOCAL_TTS_URL`.
   - Tarayıcı yedeğinin sadece geçici bir önizleme çözümü olduğu, gerçek sistemde kullanılmayacağı açıkça belirtilir.

## Teknik notlar

- Değişen dosyalar: `src/config/local-stack.config.ts`, `src/lib/backend/tts-provider.server.ts`, `src/routes/api/assistant.ts` (fallback yanıtı), `src/lib/assistant-client.ts`, `src/lib/i18n.ts` (yedek mod bilgi metni), `README.md`.
- `src/lib/audio-player.ts` ve `VoiceWave.tsx` genel kalır; AnalyserNode tabanlı gerçek genlik animasyonu yerel motor bağlandığında tam çalışır.
- AI ve hafıza katmanlarına dokunulmaz.
