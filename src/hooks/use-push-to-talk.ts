/**
 * ============================================================================
 * PUSH-TO-TALK (BASILI TUTARAK KONUSMA) — istemci tarafi kayit katmani
 * ============================================================================
 * Tuş basılı tutulduğu sürece mikrofonu kaydeder, bırakılınca sesi TEK merkezi
 * STT ucuna (`transcribeSpeech()` -> /api/assistant action:"stt") gonderir.
 *
 * Yerel Whisper sunucusu kapaliysa backend `{ fallback: true }` doner ve
 * SADECE gelistirme/onizleme icin tarayici `SpeechRecognition` sonucu
 * kullanilir (kayit ile es zamanli dinlenir). Uretimde kullanilmaz.
 * ============================================================================
 */

import { useCallback, useEffect, useRef, useState } from "react";

import { transcribeSpeech, type Language } from "@/lib/assistant-client";

type Options = {
  /** KeyboardEvent.code, orn. "ControlRight" */
  keyCode: string;
  language: Language;
  enabled: boolean;
  onTranscript: (text: string) => void;
  /**
   * Saglayici yoneticisinin verdigi izinler. Kapali bir saglayici HICBIR
   * kosulda cagrilmaz (`planStt()` — src/lib/services/voice.ts).
   */
  allowLocal?: boolean;
  allowBrowser?: boolean;
  /** Kullanim olcumu: hangi saglayici, kac saniye ses islendi. */
  onUsage?: (serviceId: string, seconds: number) => void;
};

type SpeechRecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: (() => void) | null;
};

function createRecognition(language: Language): SpeechRecognitionLike | null {
  const w = window as unknown as {
    SpeechRecognition?: new () => SpeechRecognitionLike;
    webkitSpeechRecognition?: new () => SpeechRecognitionLike;
  };
  const Ctor = w.SpeechRecognition ?? w.webkitSpeechRecognition;
  if (!Ctor) return null;
  const recognition = new Ctor();
  recognition.lang = language === "tr" ? "tr-TR" : "en-US";
  recognition.continuous = true;
  recognition.interimResults = true;
  return recognition;
}

export function usePushToTalk({
  keyCode,
  language,
  enabled,
  onTranscript,
  allowLocal = true,
  allowBrowser = true,
  onUsage,
}: Options) {
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [levels, setLevels] = useState<number[]>([]);
  const [error, setError] = useState<string | null>(null);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const rafRef = useRef<number | null>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const fallbackTextRef = useRef("");
  const startingRef = useRef(false);
  const startedAtRef = useRef(0);

  const cleanupMeter = useCallback(() => {
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    void audioCtxRef.current?.close().catch(() => {});
    audioCtxRef.current = null;
    setLevels([]);
  }, []);

  const stop = useCallback(() => {
    if (!recorderRef.current) return;
    try {
      recorderRef.current.stop();
    } catch {
      /* yoksay */
    }
    try {
      recognitionRef.current?.stop();
    } catch {
      /* yoksay */
    }
    setRecording(false);
  }, []);

  const start = useCallback(async () => {
    if (recorderRef.current || startingRef.current) return;
    // Hicbir STT saglayicisina izin yoksa mikrofon HIC acilmaz.
    if (!allowLocal && !allowBrowser) {
      setError("stt-disabled");
      return;
    }
    startingRef.current = true;
    setError(null);
    fallbackTextRef.current = "";
    startedAtRef.current = Date.now();


    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      // Gercek genlige gore kayit gostergesi
      const audioCtx = new AudioContext();
      audioCtxRef.current = audioCtx;
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 512;
      audioCtx.createMediaStreamSource(stream).connect(analyser);
      const data = new Uint8Array(analyser.frequencyBinCount);
      const bands = 9;
      const tick = () => {
        analyser.getByteFrequencyData(data);
        const size = Math.floor(data.length / bands);
        setLevels(
          Array.from({ length: bands }, (_, band) => {
            let sum = 0;
            for (let i = band * size; i < (band + 1) * size; i += 1) sum += data[i] ?? 0;
            return Math.min(1, sum / size / 180);
          }),
        );
        rafRef.current = requestAnimationFrame(tick);
      };
      rafRef.current = requestAnimationFrame(tick);

      // Tarayici ses tanima SAGLAYICISI — yalnizca izin verildiyse baslatilir.
      const recognition = allowBrowser ? createRecognition(language) : null;
      recognitionRef.current = recognition;
      if (recognition) {
        recognition.onresult = (event) => {
          let text = "";
          for (let i = 0; i < event.results.length; i += 1) {
            text += event.results[i]?.[0]?.transcript ?? "";
          }
          fallbackTextRef.current = text.trim();
        };
        recognition.onerror = () => {};
        try {
          recognition.start();
        } catch {
          /* yoksay */
        }
      }


      const mimeType = MediaRecorder.isTypeSupported("audio/webm")
        ? "audio/webm"
        : MediaRecorder.isTypeSupported("audio/ogg")
          ? "audio/ogg"
          : "";
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      chunksRef.current = [];
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };
      recorder.onstop = async () => {
        cleanupMeter();
        streamRef.current?.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
        recorderRef.current = null;

        const seconds = Math.max(0, (Date.now() - startedAtRef.current) / 1000);
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" });
        chunksRef.current = [];
        // Bos/cok kisa kayit gonderilmez.
        if (blob.size < 1200) return;

        setTranscribing(true);
        try {
          let localText = "";
          let localUnavailable = false;

          if (allowLocal) {
            const base64 = await new Promise<string>((resolve, reject) => {
              const reader = new FileReader();
              reader.onload = () => {
                const result = String(reader.result);
                resolve(result.slice(result.indexOf(",") + 1));
              };
              reader.onerror = reject;
              reader.readAsDataURL(blob);
            });

            const response = await transcribeSpeech({
              audioBase64: base64,
              mimeType: blob.type || "audio/webm",
              language,
            });
            localText = response.text?.trim() ?? "";
            localUnavailable = Boolean(response.fallback);
            if (localText) onUsage?.("stt.local", seconds);
          }

          if (localText) {
            onTranscript(localText);
          } else {
            const text = allowBrowser ? fallbackTextRef.current.trim() : "";
            if (text) {
              onUsage?.("stt.browser", seconds);
              onTranscript(text);
            } else if (localUnavailable || !allowLocal) {
              setError("stt-unavailable");
            }
          }
        } catch {
          const text = allowBrowser ? fallbackTextRef.current.trim() : "";
          if (text) {
            onUsage?.("stt.browser", seconds);
            onTranscript(text);
          } else setError("stt-failed");
        } finally {
          setTranscribing(false);
        }
      };


      recorder.start();
      recorderRef.current = recorder;
      setRecording(true);
    } catch {
      cleanupMeter();
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
      setError("mic-denied");
      setRecording(false);
    } finally {
      startingRef.current = false;
    }
  }, [allowBrowser, allowLocal, cleanupMeter, language, onTranscript, onUsage]);

  // Basili tut / birak
  useEffect(() => {
    if (!enabled) return;
    const isTarget = (event: KeyboardEvent) => event.code === keyCode;

    const onDown = (event: KeyboardEvent) => {
      if (!isTarget(event) || event.repeat) return;
      event.preventDefault();
      void start();
    };
    const onUp = (event: KeyboardEvent) => {
      if (!isTarget(event)) return;
      event.preventDefault();
      stop();
    };

    window.addEventListener("keydown", onDown);
    window.addEventListener("keyup", onUp);
    window.addEventListener("blur", stop);
    return () => {
      window.removeEventListener("keydown", onDown);
      window.removeEventListener("keyup", onUp);
      window.removeEventListener("blur", stop);
    };
  }, [enabled, keyCode, start, stop]);

  return { recording, transcribing, levels, error, start, stop };
}
