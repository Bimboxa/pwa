import { useCallback, useEffect, useRef, useState } from "react";

// Web Speech API dictation for the chat input.
//
// `start(baseText)` snapshots the current text, then every recognition result
// calls `onText(base + finals + interim)`. `rebase(text)` lets the caller
// replace the base when the user types while listening. The recognizer is
// created on demand (first user gesture) — iOS refuses `start()` otherwise.
//
// Chrome ends the session after a few seconds of silence and Safari iOS after
// each utterance: `onend` restarts while `activeRef` is still true.

const RESTART_DELAY_MS = 150;

function getSpeechRecognition() {
  if (typeof window === "undefined") return null;
  return window.SpeechRecognition || window.webkitSpeechRecognition || null;
}

function join(base, spoken) {
  if (!spoken) return base;
  if (!base) return spoken;
  return /\s$/.test(base) ? base + spoken : `${base} ${spoken}`;
}

export default function useSpeechDictation({ onText, lang = "fr-FR" }) {
  // strings

  const notAllowedS = "Micro non autorisé par le navigateur";
  const networkS = "Dictée indisponible (réseau)";
  const genericS = "Dictée interrompue";

  // state

  const [supported] = useState(() => Boolean(getSpeechRecognition()));
  const [listening, setListening] = useState(false);
  const [error, setError] = useState(null);

  const recognitionRef = useRef(null);
  const activeRef = useRef(false);
  const baseRef = useRef("");
  const finalRef = useRef("");
  const restartTimerRef = useRef(null);
  const onTextRef = useRef(onText);
  onTextRef.current = onText;

  // helpers

  const clearRestartTimer = () => {
    if (restartTimerRef.current) {
      clearTimeout(restartTimerRef.current);
      restartTimerRef.current = null;
    }
  };

  const safeStart = (recognition) => {
    try {
      recognition.start();
    } catch {
      // Already started: Chrome throws when `start` overlaps `onend`.
    }
  };

  const stop = useCallback(() => {
    activeRef.current = false;
    clearRestartTimer();
    try {
      recognitionRef.current?.stop();
    } catch {
      // ignore
    }
    setListening(false);
  }, []);

  const createRecognition = () => {
    const SpeechRecognition = getSpeechRecognition();
    if (!SpeechRecognition) return null;

    const recognition = new SpeechRecognition();
    recognition.lang = lang;
    recognition.interimResults = true;
    recognition.continuous = true;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      setListening(true);
    };

    recognition.onresult = (event) => {
      let interim = "";
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const result = event.results[i];
        const transcript = result[0]?.transcript ?? "";
        if (result.isFinal) {
          finalRef.current = join(finalRef.current, transcript.trim());
        } else {
          interim += transcript;
        }
      }
      const spoken = join(finalRef.current, interim.trim());
      onTextRef.current?.(join(baseRef.current, spoken));
    };

    recognition.onerror = (event) => {
      const code = event?.error;
      if (code === "no-speech" || code === "aborted") return;
      if (code === "not-allowed" || code === "service-not-allowed") {
        setError(notAllowedS);
      } else if (code === "network") {
        setError(networkS);
      } else {
        setError(genericS);
      }
      stop();
    };

    recognition.onend = () => {
      if (!activeRef.current) {
        setListening(false);
        return;
      }
      clearRestartTimer();
      restartTimerRef.current = setTimeout(() => {
        restartTimerRef.current = null;
        if (activeRef.current) safeStart(recognition);
      }, RESTART_DELAY_MS);
    };

    return recognition;
  };

  // handlers

  const start = useCallback((baseText = "") => {
    if (activeRef.current) return;
    if (!recognitionRef.current) recognitionRef.current = createRecognition();
    const recognition = recognitionRef.current;
    if (!recognition) return;

    setError(null);
    baseRef.current = baseText;
    finalRef.current = "";
    activeRef.current = true;
    safeStart(recognition);
  }, []);

  const toggle = useCallback(
    (baseText = "") => {
      if (activeRef.current) stop();
      else start(baseText);
    },
    [start, stop]
  );

  // The user typed while listening: the next result builds on that text.
  const rebase = useCallback((text) => {
    baseRef.current = text ?? "";
    finalRef.current = "";
  }, []);

  useEffect(() => {
    return () => {
      activeRef.current = false;
      clearRestartTimer();
      try {
        recognitionRef.current?.abort();
      } catch {
        // ignore
      }
    };
  }, []);

  return { supported, listening, error, start, stop, toggle, rebase };
}
