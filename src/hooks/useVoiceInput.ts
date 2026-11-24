import { useCallback, useEffect, useRef, useState } from 'react';

interface SpeechRecognitionAlternativeLike {
  transcript: string;
  confidence: number;
}

interface SpeechRecognitionResultLike {
  isFinal: boolean;
  length: number;
  [index: number]: SpeechRecognitionAlternativeLike;
}

interface SpeechRecognitionResultListLike {
  length: number;
  [index: number]: SpeechRecognitionResultLike;
}

interface SpeechRecognitionEventLike extends Event {
  resultIndex: number;
  results: SpeechRecognitionResultListLike;
}

interface SpeechRecognitionErrorEventLike extends Event {
  error: string;
  message?: string;
}

interface SpeechRecognitionInstance extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  maxAlternatives: number;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onstart: ((this: SpeechRecognitionInstance, ev: Event) => void) | null;
  onend: ((this: SpeechRecognitionInstance, ev: Event) => void) | null;
  onerror: ((this: SpeechRecognitionInstance, ev: SpeechRecognitionErrorEventLike) => void) | null;
  onresult: ((this: SpeechRecognitionInstance, ev: SpeechRecognitionEventLike) => void) | null;
}

type SpeechRecognitionConstructor = new () => SpeechRecognitionInstance;

function getSpeechRecognitionConstructor(): SpeechRecognitionConstructor | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  };
  return w.SpeechRecognition || w.webkitSpeechRecognition || null;
}

export interface UseVoiceInputOptions {
  lang?: string;
  onTranscriptFinal?: (transcript: string) => void;
  onTranscriptUpdate?: (transcript: string) => void;
}

export function useVoiceInput({
  lang = 'en-US',
  onTranscriptFinal,
  onTranscriptUpdate,
}: UseVoiceInputOptions = {}) {
  const [isSupported] = useState<boolean>(() => getSpeechRecognitionConstructor() !== null);
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [interimTranscript, setInterimTranscript] = useState('');
  const [voiceError, setVoiceError] = useState<string | null>(null);

  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const finalBufferRef = useRef('');
  const onFinalRef = useRef(onTranscriptFinal);
  const onUpdateRef = useRef(onTranscriptUpdate);

  useEffect(() => {
    onFinalRef.current = onTranscriptFinal;
    onUpdateRef.current = onTranscriptUpdate;
  }, [onTranscriptFinal, onTranscriptUpdate]);

  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        // Ignore if recognition already stopped
      }
    }
    setIsListening(false);
  }, []);

  const abortListening = useCallback(() => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.abort();
      } catch {
        // Ignore
      }
      recognitionRef.current = null;
    }
    setIsListening(false);
  }, []);

  const resetTranscript = useCallback(() => {
    finalBufferRef.current = '';
    setTranscript('');
    setInterimTranscript('');
    setVoiceError(null);
  }, []);

  const startListening = useCallback(async () => {
    setVoiceError(null);

    const SpeechRec = getSpeechRecognitionConstructor();
    if (!SpeechRec) {
      setVoiceError(
        'Voice input requires a browser supporting the Web Speech API (Chrome, Edge, or Safari).'
      );
      return;
    }

    // Stop any previous instance cleanly
    if (recognitionRef.current) {
      try {
        recognitionRef.current.abort();
      } catch {
        // Ignore
      }
      recognitionRef.current = null;
    }

    // Explicitly request microphone access first so permission errors are handled reliably
    if (navigator.mediaDevices?.getUserMedia) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        stream.getTracks().forEach((track) => track.stop());
      } catch (err) {
        const name = err instanceof Error ? err.name : '';
        if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
          setVoiceError(
            'Microphone access was denied. Allow microphone permissions in your browser and try again.'
          );
        } else if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
          setVoiceError('No microphone device was detected on this system.');
        } else {
          setVoiceError('Unable to access microphone. Check your browser audio settings.');
        }
        return;
      }
    }

    finalBufferRef.current = '';
    setTranscript('');
    setInterimTranscript('');

    const recognition = new SpeechRec();
    recognition.lang = lang;
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      setIsListening(true);
      setVoiceError(null);
    };

    recognition.onresult = (event: SpeechRecognitionEventLike) => {
      let interim = '';
      let finalSegment = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const res = event.results[i];
        const text = res[0]?.transcript ?? '';
        if (res.isFinal) {
          finalSegment += text;
        } else {
          interim += text;
        }
      }

      if (finalSegment) {
        finalBufferRef.current = `${finalBufferRef.current} ${finalSegment}`.trim();
        setTranscript(finalBufferRef.current);
        onUpdateRef.current?.(finalBufferRef.current);
      }

      setInterimTranscript(interim.trim());
      if (interim.trim()) {
        const combined = `${finalBufferRef.current} ${interim}`.trim();
        onUpdateRef.current?.(combined);
      }
    };

    recognition.onerror = (event: SpeechRecognitionErrorEventLike) => {
      setIsListening(false);
      if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
        setVoiceError(
          'Microphone permission denied. Please enable microphone access for this site.'
        );
      } else if (event.error === 'audio-capture') {
        setVoiceError('No microphone detected. Please connect a microphone.');
      } else if (event.error === 'no-speech') {
        setVoiceError('No speech detected. Tap the microphone and try speaking again.');
      } else if (event.error !== 'aborted') {
        setVoiceError(`Voice recognition error: ${event.error}.`);
      }
    };

    recognition.onend = () => {
      setIsListening(false);
      setInterimTranscript('');
      recognitionRef.current = null;
      const finalText = finalBufferRef.current.trim();
      if (finalText) {
        onFinalRef.current?.(finalText);
      }
    };

    recognitionRef.current = recognition;
    try {
      recognition.start();
    } catch {
      setIsListening(false);
      setVoiceError('Could not start speech recognition. Please try again.');
    }
  }, [lang]);

  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch {
          // Ignore cleanup errors
        }
      }
    };
  }, []);

  return {
    isSupported,
    isListening,
    transcript,
    interimTranscript,
    voiceError,
    startListening,
    stopListening,
    abortListening,
    resetTranscript,
  };
}
