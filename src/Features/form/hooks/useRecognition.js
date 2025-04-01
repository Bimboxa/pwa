import {useRef, useEffect, useState} from "react";

export default function useRecognition(onChange) {
  // TO DO : handle onEnd and onStart as onChange.

  const recognitionRef = useRef(null);
  const recordingRef = useRef(false);
  //const [interimTranscript, setInterimTranscript] = useState("");

  useEffect(() => {
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      console.warn("Speech Recognition non supportée par ce navigateur.");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = "fr-FR";
    recognition.interimResults = true;
    recognition.continuous = true;
    recognition.maxAlternatives = 1;

    let lastTranscript = "";

    recognition.onstart = () => {
      console.log("start of recognition");
      recordingRef.current = true;
    };

    recognition.onend = () => {
      console.log("end of recognition");
      recordingRef.current = false;
    };

    recognition.onresult = (event) => {
      let interim = "";
      let final = "";

      for (let i = event.resultIndex; i < event.results.length; ++i) {
        const result = event.results[i];
        if (result.isFinal) {
          final += result[0].transcript;
        } else {
          interim += result[0].transcript;
        }
      }

      if (final) {
        lastTranscript += final;
        onChange(lastTranscript);
      }

      if (interim) {
        //setInterimTranscript(lastTranscript + interim);
        onChange(lastTranscript + interim);
      }
    };

    recognition.onerror = (event) => {
      console.error("Erreur de reconnaissance vocale :", event.error);
    };

    recognitionRef.current = recognition;
  }, []);

  const start = () => {
    try {
      recognitionRef.current?.start();
    } catch (e) {
      console.warn("Erreur au démarrage :", e);
    }
  };

  const stop = () => {
    try {
      console.log("Stopping recognition");
      //recognitionRef.current?.abort();
      recognitionRef.current?.stop();
    } catch (e) {
      console.warn("Erreur à l'arrêt :", e);
    }
  };

  return {
    recognitionRef,
    recordingRef: recordingRef,
    //interimTranscript,
  };
}
