'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Type definitions for the Web Speech API
 */
interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList;
  resultIndex: number;
}

interface SpeechRecognitionErrorEvent extends Event {
  error: string;
  message?: string;
}

interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  onstart: (() => void) | null;
}

interface SpeechRecognitionConstructor {
  new (): SpeechRecognition;
}

declare global {
  interface Window {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  }
}

export interface UseSpeechRecognitionOptions {
  /**
   * Language for speech recognition (e.g., 'en-US', 'ja-JP')
   * @default 'ja-JP'
   */
  lang?: string;
  /**
   * Whether to provide interim (in-progress) results
   * @default true
   */
  interimResults?: boolean;
  /**
   * Callback when speech is recognized
   */
  onResult?: (transcript: string, isFinal: boolean) => void;
  /**
   * Callback when an error occurs
   */
  onError?: (error: string) => void;
}

export interface UseSpeechRecognitionReturn {
  /**
   * Whether speech recognition is currently active
   */
  isListening: boolean;
  /**
   * Whether the Web Speech API is supported
   */
  isSupported: boolean;
  /**
   * Current transcript (interim or final)
   */
  transcript: string;
  /**
   * Start listening for speech
   */
  startListening: () => void;
  /**
   * Stop listening for speech
   */
  stopListening: () => void;
  /**
   * Toggle listening state
   */
  toggleListening: () => void;
  /**
   * Reset the transcript
   */
  resetTranscript: () => void;
  /**
   * Error message if any
   */
  error: string | null;
}

/**
 * Custom hook for Web Speech API voice input
 */
export function useSpeechRecognition(
  options: UseSpeechRecognitionOptions = {}
): UseSpeechRecognitionReturn {
  const { lang = 'ja-JP', interimResults = true, onResult, onError } = options;

  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSupported, setIsSupported] = useState(false);

  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const finalTranscriptRef = useRef('');

  // Check for browser support
  useEffect(() => {
    const SpeechRecognitionAPI =
      typeof window !== 'undefined'
        ? window.SpeechRecognition || window.webkitSpeechRecognition
        : undefined;
    setIsSupported(!!SpeechRecognitionAPI);
  }, []);

  // Initialize speech recognition
  useEffect(() => {
    const SpeechRecognitionAPI =
      typeof window !== 'undefined'
        ? window.SpeechRecognition || window.webkitSpeechRecognition
        : undefined;

    if (!SpeechRecognitionAPI) {
      return;
    }

    const recognition = new SpeechRecognitionAPI();
    recognition.continuous = true;
    recognition.interimResults = interimResults;
    recognition.lang = lang;

    recognition.onstart = () => {
      setIsListening(true);
      setError(null);
    };

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let interimText = '';
      let finalText = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          finalText += result[0].transcript;
        } else {
          interimText += result[0].transcript;
        }
      }

      // Accumulate final transcripts
      if (finalText) {
        finalTranscriptRef.current += (finalTranscriptRef.current ? ' ' : '') + finalText;
      }

      // Combine accumulated final transcript with current interim
      const fullTranscript = finalTranscriptRef.current + (interimText ? ` ${interimText}` : '');
      setTranscript(fullTranscript);
      onResult?.(fullTranscript, !!finalText);
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      const errorMessage = getErrorMessage(event.error);
      setError(errorMessage);
      setIsListening(false);
      onError?.(errorMessage);
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognitionRef.current = recognition;

    return () => {
      recognition.abort();
      recognitionRef.current = null;
    };
  }, [lang, interimResults, onResult, onError]);

  const startListening = useCallback(() => {
    if (!recognitionRef.current || isListening) return;

    setError(null);
    setTranscript('');
    finalTranscriptRef.current = '';

    try {
      recognitionRef.current.start();
    } catch (e) {
      // Handle case where recognition is already started
      if (e instanceof Error && e.message.includes('already started')) {
        setError('Recognition is already active');
      }
    }
  }, [isListening]);

  const stopListening = useCallback(() => {
    if (!recognitionRef.current || !isListening) return;

    try {
      recognitionRef.current.stop();
    } catch {
      // Ignore errors when stopping
    }
  }, [isListening]);

  const toggleListening = useCallback(() => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  }, [isListening, startListening, stopListening]);

  const resetTranscript = useCallback(() => {
    setTranscript('');
    finalTranscriptRef.current = '';
  }, []);

  return {
    isListening,
    isSupported,
    transcript,
    startListening,
    stopListening,
    toggleListening,
    resetTranscript,
    error,
  };
}

/**
 * Get user-friendly error message
 */
function getErrorMessage(error: string): string {
  switch (error) {
    case 'no-speech':
      return 'No speech was detected. Please try again.';
    case 'audio-capture':
      return 'No microphone was found. Please ensure a microphone is connected.';
    case 'not-allowed':
      return 'Microphone access was denied. Please allow microphone access to use voice input.';
    case 'network':
      return 'Network error occurred. Please check your connection.';
    case 'aborted':
      return 'Speech recognition was aborted.';
    case 'language-not-supported':
      return 'The selected language is not supported.';
    case 'service-not-allowed':
      return 'Speech recognition service is not allowed.';
    default:
      return `Speech recognition error: ${error}`;
  }
}
