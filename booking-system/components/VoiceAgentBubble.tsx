'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Mic, MicOff, PhoneOff, UserRoundPlus, X, MessageCircle, ChevronDown, Loader2 } from 'lucide-react';
import {
    bookingVoiceController,
    VOICE_EVENTS,
    WIZARD_EVENTS,
    fuzzyMatch,
} from '@/lib/booking-voice-controller';

/* ─────────────────────────────────────────────
   Types
   ───────────────────────────────────────────── */

interface ChatMessage {
    role: 'user' | 'assistant';
    content: string;
}

interface BookingContext {
    step: number;
    stepName: string;
    options: { id: string; name: string }[];
}

/* ─────────────────────────────────────────────
   VoiceAgentBubble — Main component
   Uses browser mic → Whisper STT → GPT intent → browser TTS
   ───────────────────────────────────────────── */

export default function VoiceAgentBubble() {
    const [isOpen, setIsOpen] = useState(false);
    const [isListening, setIsListening] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);
    const [isSpeaking, setIsSpeaking] = useState(false);
    const [isConnected, setIsConnected] = useState(false);
    const [transcript, setTranscript] = useState('');
    const [chatLog, setChatLog] = useState<ChatMessage[]>([]);
    const [error, setError] = useState('');

    // Refs
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const audioChunksRef = useRef<Blob[]>([]);
    const streamRef = useRef<MediaStream | null>(null);
    const analyserRef = useRef<AnalyserNode | null>(null);
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const animFrameRef = useRef<number>(0);
    const contextRef = useRef<BookingContext>({ step: 0, stepName: 'Clinic', options: [] });
    const chatHistoryRef = useRef<ChatMessage[]>([]);
    const chatEndRef = useRef<HTMLDivElement>(null);
    const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Auto-scroll chat
    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [chatLog]);

    /* ── Booking voice controller listeners ── */
    useEffect(() => {
        const onStepChanged = (data: { step: number; stepName: string }) => {
            contextRef.current.step = data.step;
            contextRef.current.stepName = data.stepName;
        };

        const onOptions = (data: { step: number; items: { id: string; name: string }[] }) => {
            contextRef.current.options = data.items;
        };

        const offStep = bookingVoiceController.on(WIZARD_EVENTS.STEP_CHANGED, onStepChanged);
        const offOpts = bookingVoiceController.on(WIZARD_EVENTS.OPTIONS, onOptions);

        return () => {
            offStep();
            offOpts();
        };
    }, []);

    /* ── TTS: speak aloud ── */
    const speak = useCallback((text: string): Promise<void> => {
        return new Promise((resolve) => {
            if (!text || typeof window === 'undefined' || !window.speechSynthesis) {
                resolve();
                return;
            }

            // Cancel any ongoing speech
            window.speechSynthesis.cancel();

            const utterance = new SpeechSynthesisUtterance(text);
            utterance.rate = 1.0;
            utterance.pitch = 1.0;
            utterance.volume = 1.0;

            // Try to find a good English voice
            const voices = window.speechSynthesis.getVoices();
            const preferred = voices.find(v =>
                v.lang.startsWith('en') && (v.name.includes('Google') || v.name.includes('Female') || v.name.includes('Samantha'))
            ) || voices.find(v => v.lang.startsWith('en'));
            if (preferred) utterance.voice = preferred;

            utterance.onstart = () => setIsSpeaking(true);
            utterance.onend = () => { setIsSpeaking(false); resolve(); };
            utterance.onerror = () => { setIsSpeaking(false); resolve(); };

            window.speechSynthesis.speak(utterance);
        });
    }, []);

    /* ── Process recorded audio ── */
    const processAudio = useCallback(async (audioBlob: Blob) => {
        if (audioBlob.size < 1000) return; // Skip tiny recordings (silence)

        setIsProcessing(true);
        setError('');

        try {
            // Step 1: Transcribe with Whisper
            const formData = new FormData();
            formData.append('audio', audioBlob, 'recording.webm');

            const transcribeRes = await fetch('/api/whisper/transcribe', {
                method: 'POST',
                body: formData,
            });

            if (!transcribeRes.ok) {
                throw new Error('Transcription failed');
            }

            const { text } = await transcribeRes.json();
            if (!text?.trim()) {
                setIsProcessing(false);
                return;
            }

            setTranscript(text);
            const userMsg: ChatMessage = { role: 'user', content: text };
            setChatLog(prev => [...prev, userMsg]);
            chatHistoryRef.current.push(userMsg);

            // Step 2: Get GPT intent + response
            const chatRes = await fetch('/api/whisper/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    transcript: text,
                    step: contextRef.current.step,
                    stepName: contextRef.current.stepName,
                    options: contextRef.current.options,
                    conversationHistory: chatHistoryRef.current.slice(-6),
                }),
            });

            if (!chatRes.ok) {
                throw new Error('Chat processing failed');
            }

            const { action, name, spokenResponse } = await chatRes.json();

            // Add assistant response to chat
            const assistantMsg: ChatMessage = { role: 'assistant', content: spokenResponse };
            setChatLog(prev => [...prev, assistantMsg]);
            chatHistoryRef.current.push(assistantMsg);

            // Step 3: Execute booking action via the event bus
            if (action && action !== 'none') {
                executeAction(action, name);
            }

            // Step 4: Speak the response
            setIsProcessing(false);
            await speak(spokenResponse);
        } catch (err) {
            console.error('[VoiceAgent] Processing error:', err);
            setError('Something went wrong. Please try again.');
            setIsProcessing(false);
        }
    }, [speak]);

    /* ── Execute booking action ── */
    const executeAction = useCallback((action: string, name: string) => {
        const ctx = contextRef.current;

        switch (action) {
            case 'selectClinic': {
                const match = fuzzyMatch(name, ctx.options);
                if (match) bookingVoiceController.emit(VOICE_EVENTS.SELECT_CLINIC, { name: match.name });
                break;
            }
            case 'selectDept': {
                const match = fuzzyMatch(name, ctx.options);
                if (match) bookingVoiceController.emit(VOICE_EVENTS.SELECT_DEPT, { name: match.name });
                break;
            }
            case 'selectService': {
                const match = fuzzyMatch(name, ctx.options);
                if (match) bookingVoiceController.emit(VOICE_EVENTS.SELECT_SERVICE, { name: match.name });
                break;
            }
            case 'selectDoctor': {
                const match = fuzzyMatch(name, ctx.options);
                if (match) bookingVoiceController.emit(VOICE_EVENTS.SELECT_DOCTOR, { name: match.name });
                break;
            }
            case 'selectDate':
                bookingVoiceController.emit(VOICE_EVENTS.SELECT_DATE, { date: name });
                break;
            case 'selectSlot':
                bookingVoiceController.emit(VOICE_EVENTS.SELECT_SLOT, { time: name });
                break;
            case 'confirm':
                bookingVoiceController.emit(VOICE_EVENTS.CONFIRM, {});
                break;
            case 'goBack':
                bookingVoiceController.emit(VOICE_EVENTS.GO_BACK, {});
                break;
            case 'transfer':
                handleTransfer();
                break;
        }
    }, []);

    /* ── Start/stop mic recording ── */
    const startListening = useCallback(async () => {
        try {
            setError('');
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            streamRef.current = stream;

            // Set up audio analyser for waveform visualization
            const audioCtx = new AudioContext();
            const source = audioCtx.createMediaStreamSource(stream);
            const analyser = audioCtx.createAnalyser();
            analyser.fftSize = 256;
            source.connect(analyser);
            analyserRef.current = analyser;

            // Start media recorder
            const recorder = new MediaRecorder(stream, {
                mimeType: MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
                    ? 'audio/webm;codecs=opus'
                    : 'audio/webm',
            });

            audioChunksRef.current = [];

            recorder.ondataavailable = (e) => {
                if (e.data.size > 0) {
                    audioChunksRef.current.push(e.data);
                }
            };

            recorder.onstop = () => {
                const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
                processAudio(audioBlob);
            };

            recorder.start(250); // Collect data every 250ms
            mediaRecorderRef.current = recorder;
            setIsListening(true);
            setIsConnected(true);

            // Start waveform visualization
            drawWaveform();
        } catch (err) {
            console.error('[VoiceAgent] Mic access error:', err);
            setError('Could not access microphone. Please allow microphone access.');
        }
    }, [processAudio]);

    const stopListening = useCallback(() => {
        if (silenceTimerRef.current) {
            clearTimeout(silenceTimerRef.current);
            silenceTimerRef.current = null;
        }

        if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
            mediaRecorderRef.current.stop();
        }

        if (streamRef.current) {
            streamRef.current.getTracks().forEach(t => t.stop());
            streamRef.current = null;
        }

        if (animFrameRef.current) {
            cancelAnimationFrame(animFrameRef.current);
        }

        analyserRef.current = null;
        setIsListening(false);
    }, []);

    /* ── Waveform visualization ── */
    const drawWaveform = useCallback(() => {
        const canvas = canvasRef.current;
        const analyser = analyserRef.current;
        if (!canvas || !analyser) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const bufferLength = analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);

        const draw = () => {
            animFrameRef.current = requestAnimationFrame(draw);
            analyser.getByteFrequencyData(dataArray);

            ctx.fillStyle = 'rgba(0, 0, 0, 0)';
            ctx.clearRect(0, 0, canvas.width, canvas.height);

            const barWidth = (canvas.width / bufferLength) * 2.5;
            let x = 0;

            for (let i = 0; i < bufferLength; i++) {
                const barHeight = (dataArray[i] / 255) * canvas.height * 0.8;

                const gradient = ctx.createLinearGradient(0, canvas.height, 0, canvas.height - barHeight);
                gradient.addColorStop(0, '#6366f1');
                gradient.addColorStop(1, '#a5b4fc');

                ctx.fillStyle = gradient;
                ctx.fillRect(x, canvas.height - barHeight, barWidth - 1, barHeight);
                x += barWidth;
            }
        };

        draw();
    }, []);

    /* ── Disconnect session ── */
    const disconnect = useCallback(() => {
        stopListening();
        window.speechSynthesis?.cancel();
        setIsConnected(false);
        setIsOpen(false);
        setChatLog([]);
        chatHistoryRef.current = [];
        setTranscript('');
        setError('');
    }, [stopListening]);

    /* ── Transfer to human ── */
    const handleTransfer = useCallback(async () => {
        try {
            await fetch('/api/voice-agent/transfer', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    sessionId: `whisper-${Date.now()}`,
                    source: 'booking-page',
                }),
            });
            await speak('I\'m transferring you to a human representative. Please hold on.');
        } catch (err) {
            console.error('[VoiceAgent] Transfer error:', err);
        }
    }, [speak]);

    /* ── Toggle panel ── */
    const toggle = useCallback(() => {
        if (!isOpen) {
            setIsOpen(true);
            // Auto-start greeting on first open
            if (!isConnected) {
                setIsConnected(true);
                const greeting = 'Hello! I\'m your booking assistant. Click the microphone button and tell me how I can help you today.';
                const msg: ChatMessage = { role: 'assistant', content: greeting };
                setChatLog([msg]);
                chatHistoryRef.current = [msg];
                speak(greeting);
            }
        } else {
            setIsOpen(false);
        }
    }, [isOpen, isConnected, speak]);

    /* ── Cleanup on unmount ── */
    useEffect(() => {
        return () => {
            disconnect();
        };
    }, [disconnect]);

    /* ── Render ── */
    return (
        <>
            {/* Floating bubble */}
            {!isOpen && (
                <button
                    onClick={toggle}
                    className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg flex items-center justify-center transition-all hover:scale-110"
                    aria-label="Open voice assistant"
                >
                    <MessageCircle className="w-6 h-6" />
                    {/* Pulse ring */}
                    <span className="absolute inset-0 rounded-full bg-indigo-400 animate-ping opacity-30" />
                </button>
            )}

            {/* Expanded panel */}
            {isOpen && (
                <div className="fixed bottom-6 right-6 z-50 w-[380px] max-h-[520px] bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 flex flex-col overflow-hidden">
                    {/* Header */}
                    <div className="flex items-center justify-between px-4 py-3 bg-indigo-600 text-white rounded-t-2xl">
                        <div className="flex items-center gap-2">
                            <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-400' : 'bg-gray-400'}`} />
                            <span className="font-semibold text-sm">Voice Assistant</span>
                            {isProcessing && <Loader2 className="w-4 h-4 animate-spin" />}
                        </div>
                        <div className="flex items-center gap-1">
                            <button
                                onClick={() => setIsOpen(false)}
                                className="p-1 hover:bg-indigo-700 rounded"
                                aria-label="Minimize"
                            >
                                <ChevronDown className="w-4 h-4" />
                            </button>
                            <button
                                onClick={disconnect}
                                className="p-1 hover:bg-indigo-700 rounded"
                                aria-label="Close"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                    </div>

                    {/* Waveform / Status area */}
                    <div className="px-4 py-3 bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
                        {isListening ? (
                            <canvas
                                ref={canvasRef}
                                width={340}
                                height={50}
                                className="w-full h-[50px] rounded"
                            />
                        ) : (
                            <div className="text-center text-xs text-gray-500 dark:text-gray-400 py-2">
                                {isProcessing ? '🧠 Thinking...' :
                                    isSpeaking ? '🔊 Speaking...' :
                                        isConnected ? '🎙️ Tap the mic to speak' :
                                            'Click the mic to start'}
                            </div>
                        )}
                    </div>

                    {/* Chat log */}
                    <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 min-h-[200px] max-h-[280px]">
                        {chatLog.map((msg, i) => (
                            <div
                                key={i}
                                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                            >
                                <div
                                    className={`max-w-[80%] px-3 py-2 rounded-xl text-sm ${msg.role === 'user'
                                        ? 'bg-indigo-600 text-white rounded-br-sm'
                                        : 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-bl-sm'
                                        }`}
                                >
                                    {msg.content}
                                </div>
                            </div>
                        ))}
                        {error && (
                            <div className="text-xs text-red-500 text-center">{error}</div>
                        )}
                        <div ref={chatEndRef} />
                    </div>

                    {/* Controls */}
                    <div className="px-4 py-3 border-t border-gray-200 dark:border-gray-700 flex items-center justify-center gap-3">
                        <button
                            onClick={() => handleTransfer()}
                            className="p-2 rounded-full text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                            title="Transfer to human"
                        >
                            <UserRoundPlus className="w-5 h-5" />
                        </button>

                        <button
                            onClick={isListening ? stopListening : startListening}
                            disabled={isProcessing || isSpeaking}
                            className={`p-4 rounded-full text-white transition-all ${isListening
                                ? 'bg-red-500 hover:bg-red-600 animate-pulse'
                                : isProcessing || isSpeaking
                                    ? 'bg-gray-400 cursor-not-allowed'
                                    : 'bg-indigo-600 hover:bg-indigo-700'
                                }`}
                            title={isListening ? 'Stop recording' : 'Start recording'}
                        >
                            {isListening ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
                        </button>

                        <button
                            onClick={disconnect}
                            className="p-2 rounded-full text-gray-500 hover:bg-red-100 hover:text-red-500 dark:hover:bg-red-900/20 transition-colors"
                            title="End session"
                        >
                            <PhoneOff className="w-5 h-5" />
                        </button>
                    </div>
                </div>
            )}
        </>
    );
}
