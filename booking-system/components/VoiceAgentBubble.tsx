'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Mic, MicOff, PhoneOff, UserRoundPlus, X, ChevronDown, Loader2, Timer, Globe } from 'lucide-react';
import {
    bookingVoiceController,
    VOICE_EVENTS,
    WIZARD_EVENTS,
    fuzzyMatch,
} from '@/lib/booking-voice-controller';
import { useAuthStore } from '@/lib/store';

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
    options: { id: string; name: string; price?: number }[];
}

/* ─────────────────────────────────────────────
   VoiceAgentBubble — Main component
   Uses browser mic → Whisper STT → GPT intent → browser TTS
   ───────────────────────────────────────────── */

export default function VoiceAgentBubble() {
    const { isAuthenticated, user } = useAuthStore();
    const router = useRouter();
    const [isOpen, setIsOpen] = useState(false);
    const [isListening, setIsListening] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);
    const [isSpeaking, setIsSpeaking] = useState(false);
    const [isConnected, setIsConnected] = useState(false);
    const [transcript, setTranscript] = useState('');
    const [chatLog, setChatLog] = useState<ChatMessage[]>([]);
    const [error, setError] = useState('');
    const [dailyLimitReached, setDailyLimitReached] = useState(false);
    const [selectedLanguage, setSelectedLanguage] = useState<'en' | 'ar' | null>(null);
    const selectedLanguageRef = useRef<'en' | 'ar'>('en');

    // Compute customer details from auth store
    const customerName = user?.name || '';
    const customerGender = user?.gender || '';
    const customerAge = user?.dateOfBirth
        ? String(Math.floor((Date.now() - new Date(user.dateOfBirth).getTime()) / (365.25 * 24 * 60 * 60 * 1000)))
        : '';
    const [remainingSeconds, setRemainingSeconds] = useState(300); // 5 minutes = 300s

    const DAILY_LIMIT_SECONDS = 300; // 5 minutes
    const MAX_RECORDING_SECONDS = 15; // 15 seconds per message
    const recordingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const recordingStartRef = useRef<number>(0);

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
    const speakRef = useRef<(text: string) => Promise<void>>(() => Promise.resolve());
    const currentAudioRef = useRef<HTMLAudioElement | null>(null);
    const continuousModeRef = useRef<boolean>(false);
    const startListeningRef = useRef<() => void>(() => { });
    const silenceCheckRef = useRef<number>(0);

    // --- Daily usage tracking ---
    const getDailyKey = () => {
        const today = new Date().toISOString().split('T')[0];
        const userId = user?.phone || 'anonymous';
        return `voice_usage_${userId}_${today}`;
    };

    const getUsedSeconds = (): number => {
        if (typeof window === 'undefined') return 0;
        return parseInt(localStorage.getItem(getDailyKey()) || '0', 10);
    };

    const addUsedSeconds = (seconds: number) => {
        const used = getUsedSeconds() + seconds;
        localStorage.setItem(getDailyKey(), String(used));
        const remaining = Math.max(0, DAILY_LIMIT_SECONDS - used);
        setRemainingSeconds(remaining);
        if (remaining <= 0) setDailyLimitReached(true);
    };

    // Initialize remaining time on mount
    useEffect(() => {
        const used = getUsedSeconds();
        const remaining = Math.max(0, DAILY_LIMIT_SECONDS - used);
        setRemainingSeconds(remaining);
        if (remaining <= 0) setDailyLimitReached(true);
    }, [user?.phone]); // eslint-disable-line react-hooks/exhaustive-deps

    // Auto-scroll chat
    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [chatLog]);

    /* ── Booking voice controller listeners ── */
    const selectionSourceRef = useRef<'voice' | 'ui'>('ui');

    useEffect(() => {
        const onStepChanged = (data: { step: number; stepName: string }) => {
            contextRef.current.step = data.step;
            contextRef.current.stepName = data.stepName;
        };

        const onOptions = (data: { step: number; items: { id: string; name: string; price?: number }[] }) => {
            contextRef.current.options = data.items;
        };

        // When any selection is made (by click or voice), acknowledge it
        const onSelectionMade = (data: { step: number; selected: string }) => {
            // Only speak if the panel is open and connected
            if (!isOpen) return;

            const STEP_PROMPTS: Record<number, string> = {
                0: `Great, you've selected ${data.selected}. Now please choose a department.`,
                1: `${data.selected} department selected. Please pick a category.`,
                2: `${data.selected} category. Now choose a service.`,
                3: `${data.selected} selected. Please choose your doctor.`,
                4: `Dr. ${data.selected} selected. Now pick a date and time.`,
                5: `${data.selected} confirmed. Please review your booking and proceed.`,
            };

            const message = STEP_PROMPTS[data.step] || `${data.selected} selected.`;

            const assistantMsg: ChatMessage = { role: 'assistant', content: message };
            setChatLog(prev => [...prev, assistantMsg]);
            chatHistoryRef.current.push(assistantMsg);
            // Speak, then auto-listen if in continuous mode
            speakRef.current(message).then(() => {
                if (continuousModeRef.current) {
                    setTimeout(() => startListeningRef.current(), 400);
                }
            });
        };

        const offStep = bookingVoiceController.on(WIZARD_EVENTS.STEP_CHANGED, onStepChanged);
        const offOpts = bookingVoiceController.on(WIZARD_EVENTS.OPTIONS, onOptions);
        const offSel = bookingVoiceController.on(WIZARD_EVENTS.SELECTION_MADE, onSelectionMade);

        return () => {
            offStep();
            offOpts();
            offSel();
        };
    }, [isOpen]);

    /* ── TTS: speak aloud via OpenAI shimmer ── */
    const speak = useCallback((text: string): Promise<void> => {
        return new Promise(async (resolve) => {
            if (!text?.trim()) { resolve(); return; }

            setIsSpeaking(true);
            // Stop any currently playing audio
            if (currentAudioRef.current) {
                currentAudioRef.current.pause();
                currentAudioRef.current = null;
            }

            try {
                // Use the locked session language
                const lang = selectedLanguageRef.current;

                const res = await fetch('/api/tts', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ text, lang }),
                });

                if (!res.ok) throw new Error('TTS failed');

                const audioBlob = await res.blob();
                const audioUrl = URL.createObjectURL(audioBlob);
                const audio = new Audio(audioUrl);
                currentAudioRef.current = audio;

                audio.onended = () => {
                    setIsSpeaking(false);
                    URL.revokeObjectURL(audioUrl);
                    currentAudioRef.current = null;
                    resolve();
                };
                audio.onerror = () => {
                    setIsSpeaking(false);
                    URL.revokeObjectURL(audioUrl);
                    currentAudioRef.current = null;
                    resolve();
                };

                await audio.play();
            } catch (err) {
                console.warn('[VoiceAgent] OpenAI TTS failed, falling back to browser TTS', err);
                // Fallback to browser TTS
                if (typeof window !== 'undefined' && window.speechSynthesis) {
                    window.speechSynthesis.cancel();
                    const utterance = new SpeechSynthesisUtterance(text);
                    utterance.onend = () => { setIsSpeaking(false); resolve(); };
                    utterance.onerror = () => { setIsSpeaking(false); resolve(); };
                    window.speechSynthesis.speak(utterance);
                } else {
                    setIsSpeaking(false);
                    resolve();
                }
            }
        });
    }, []);

    /* ── Process recorded audio ── */
    // Keep speakRef in sync so event handlers always use the latest speak
    useEffect(() => { speakRef.current = speak; }, [speak]);
    const processAudio = useCallback(async (audioBlob: Blob) => {
        if (audioBlob.size < 10000) {
            // Too short / silence — just re-listen in continuous mode
            if (continuousModeRef.current) {
                setTimeout(() => startListeningRef.current(), 300);
            }
            return;
        }

        setIsProcessing(true);
        setError('');

        try {
            // Step 1: Transcribe with Whisper
            const formData = new FormData();
            formData.append('audio', audioBlob, 'recording.webm');
            formData.append('language', selectedLanguageRef.current);

            const transcribeRes = await fetch('/api/whisper/transcribe', {
                method: 'POST',
                body: formData,
            });

            if (!transcribeRes.ok) {
                // In continuous mode, don't show error — just re-listen
                console.warn('[VoiceAgent] Transcription failed, retrying...');
                setIsProcessing(false);
                if (continuousModeRef.current) {
                    setTimeout(() => startListeningRef.current(), 500);
                }
                return;
            }

            const { text } = await transcribeRes.json();
            if (!text?.trim()) {
                setIsProcessing(false);
                // Empty transcript — re-listen in continuous mode
                if (continuousModeRef.current) {
                    setTimeout(() => startListeningRef.current(), 300);
                }
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
                    language: selectedLanguageRef.current,
                    customerName,
                    customerAge,
                    customerGender,
                }),
            });

            if (!chatRes.ok) {
                throw new Error('Chat processing failed');
            }

            const { action, name, page, spokenResponse } = await chatRes.json();

            // Add assistant response to chat
            const assistantMsg: ChatMessage = { role: 'assistant', content: spokenResponse };
            setChatLog(prev => [...prev, assistantMsg]);
            chatHistoryRef.current.push(assistantMsg);

            // Step 3: Execute booking action via the event bus
            if (action && action !== 'none') {
                executeAction(action, name, page);
            }

            // Step 4: Speak the response, then auto-listen if continuous
            setIsProcessing(false);
            await speak(spokenResponse);

            // Auto-listen after speaking (continuous conversation)
            if (continuousModeRef.current) {
                setTimeout(() => startListeningRef.current(), 400);
            }
        } catch (err) {
            console.error('[VoiceAgent] Processing error:', err);
            setError('Something went wrong. Please try again.');
            setIsProcessing(false);
            // Even on error, re-listen in continuous mode
            if (continuousModeRef.current) {
                setTimeout(() => startListeningRef.current(), 1000);
            }
        }
    }, [speak]);

    /* ── Execute booking action ── */
    const executeAction = useCallback((action: string, name: string, page?: string) => {
        const ctx = contextRef.current;

        switch (action) {
            case 'selectClinic': {
                const match = fuzzyMatch(name, ctx.options);
                if (match) bookingVoiceController.emit(VOICE_EVENTS.SELECT_CLINIC, { id: match.id, name: match.name });
                break;
            }
            case 'selectDept': {
                const match = fuzzyMatch(name, ctx.options);
                if (match) bookingVoiceController.emit(VOICE_EVENTS.SELECT_DEPT, { id: match.id, name: match.name });
                break;
            }
            case 'selectCategory': {
                const match = fuzzyMatch(name, ctx.options);
                if (match) bookingVoiceController.emit(VOICE_EVENTS.SELECT_CATEGORY, { id: match.id, name: match.name });
                break;
            }
            case 'selectService': {
                const match = fuzzyMatch(name, ctx.options);
                if (match) bookingVoiceController.emit(VOICE_EVENTS.SELECT_SERVICE, { id: match.id, name: match.name });
                break;
            }
            case 'selectDoctor': {
                const match = fuzzyMatch(name, ctx.options);
                if (match) bookingVoiceController.emit(VOICE_EVENTS.SELECT_DOCTOR, { id: match.id, name: match.name });
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
            case 'navigate': {
                const dest = page === 'booking' ? '/booking' : page === 'dashboard' ? '/customer/dashboard' : null;
                if (dest) {
                    setTimeout(() => router.push(dest), 1200); // slight delay so TTS starts first
                }
                break;
            }
            case 'listBookings': {
                // Fetch and speak upcoming bookings for the logged-in user
                if (user?.phone) {
                    fetch(`/api/bookings/by-patient?phone=${encodeURIComponent(user.phone)}&name=${encodeURIComponent(user.name)}`)
                        .then(r => r.json())
                        .then(data => {
                            const bookings = data.bookings || [];
                            if (bookings.length === 0) {
                                speakRef.current('You have no upcoming appointments.');
                            } else {
                                const summary = bookings.slice(0, 3).map((b: { date: string; slot: string; status: string }) =>
                                    `${b.date} at ${b.slot} — status ${b.status}`
                                ).join('. ');
                                speakRef.current(`You have ${bookings.length} upcoming appointment${bookings.length > 1 ? 's' : ''}. ${summary}`);
                            }
                        })
                        .catch(() => speakRef.current('I could not retrieve your appointments right now.'));
                }
                break;
            }
            case 'cancelBooking':
                // Navigate to dashboard where they can cancel
                setTimeout(() => router.push('/customer/dashboard'), 1200);
                break;
            case 'rescheduleBooking':
                // Navigate to dashboard where they can reschedule
                setTimeout(() => router.push('/customer/dashboard'), 1200);
                break;
        }
    }, [router, user]);

    /* ── Start/stop mic recording ── */
    const startListening = useCallback(async () => {
        // Don't start if already listening, processing, speaking, or limit reached
        if (mediaRecorderRef.current?.state === 'recording' || dailyLimitReached) return;

        try {
            setError('');
            continuousModeRef.current = true;

            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            streamRef.current = stream;

            // Set up audio analyser for waveform visualization + silence detection
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
            recordingStartRef.current = Date.now();

            // Auto-stop after MAX_RECORDING_SECONDS (safety cap)
            recordingTimerRef.current = setTimeout(() => {
                stopListening(true); // true = keep continuous mode
            }, MAX_RECORDING_SECONDS * 1000);

            // Silence detection: auto-stop when user goes quiet for 2s
            const SILENCE_THRESHOLD = 15; // volume level
            const SILENCE_TIMEOUT = 2000; // 2 seconds of silence
            let silenceStart: number | null = null;
            const dataArray = new Uint8Array(analyser.frequencyBinCount);

            const checkSilence = () => {
                if (!analyserRef.current || mediaRecorderRef.current?.state !== 'recording') return;

                analyserRef.current.getByteFrequencyData(dataArray);
                const avg = dataArray.reduce((sum, v) => sum + v, 0) / dataArray.length;

                if (avg < SILENCE_THRESHOLD) {
                    if (!silenceStart) silenceStart = Date.now();
                    else if (Date.now() - silenceStart > SILENCE_TIMEOUT) {
                        // User has been silent long enough — auto-stop and process
                        stopListening(true);
                        return;
                    }
                } else {
                    silenceStart = null; // Reset — user is speaking
                }

                silenceCheckRef.current = requestAnimationFrame(checkSilence);
            };
            // Start silence detection after a brief delay (let user start talking)
            setTimeout(() => {
                silenceCheckRef.current = requestAnimationFrame(checkSilence);
            }, 800);

            // Start waveform visualization
            drawWaveform();
        } catch (err) {
            console.error('[VoiceAgent] Mic access error:', err);
            setError('Could not access microphone. Please allow microphone access.');
        }
    }, [processAudio, dailyLimitReached]);

    const stopListening = useCallback((keepContinuous = false) => {
        // Track recording duration for daily limit
        if (recordingStartRef.current > 0) {
            const elapsed = Math.ceil((Date.now() - recordingStartRef.current) / 1000);
            addUsedSeconds(elapsed);
            recordingStartRef.current = 0;
        }

        if (recordingTimerRef.current) {
            clearTimeout(recordingTimerRef.current);
            recordingTimerRef.current = null;
        }

        if (silenceTimerRef.current) {
            clearTimeout(silenceTimerRef.current);
            silenceTimerRef.current = null;
        }

        // Cancel silence detection
        if (silenceCheckRef.current) {
            cancelAnimationFrame(silenceCheckRef.current);
            silenceCheckRef.current = 0;
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

        // If manually stopped (not auto-silence), exit continuous mode
        if (!keepContinuous) {
            continuousModeRef.current = false;
        }
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
        continuousModeRef.current = false;
        stopListening();
        window.speechSynthesis?.cancel();

        // Email the conversation transcript to the clinic (fire-and-forget)
        if (chatHistoryRef.current.length > 1) {
            const authState = useAuthStore.getState();
            fetch('/api/voice-agent/email-transcript', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    chatLog: chatHistoryRef.current,
                    patientName: authState.user?.name || 'Unknown',
                    patientPhone: authState.user?.phone || 'N/A',
                    timestamp: new Date().toISOString(),
                }),
            }).catch(err => console.warn('[VoiceAgent] Email send failed:', err));
        }

        setIsConnected(false);
        setIsOpen(false);
        setChatLog([]);
        chatHistoryRef.current = [];
        setTranscript('');
        setError('');
        setSelectedLanguage(null);
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

    // Keep startListeningRef in sync for use in callbacks/event handlers
    useEffect(() => { startListeningRef.current = startListening; }, [startListening]);

    /* ── Start session after language is selected ── */
    const startSession = useCallback((lang: 'en' | 'ar') => {
        setSelectedLanguage(lang);
        selectedLanguageRef.current = lang;
        setIsConnected(true);

        const firstName = customerName.split(' ')[0] || '';
        const greeting = lang === 'ar'
            ? `أهلاً وسهلاً${firstName ? ` ${firstName}` : ''}! أنا مساعدك الافتراضي. كيف أقدر أساعدك اليوم؟`
            : `Welcome back${firstName ? `, ${firstName}` : ''}! I'm your virtual assistant. How can I assist you today?`;

        const msg: ChatMessage = { role: 'assistant', content: greeting };
        setChatLog([msg]);
        chatHistoryRef.current = [msg];
        speak(greeting).then(() => {
            continuousModeRef.current = true;
            setTimeout(() => startListeningRef.current(), 400);
        });
    }, [customerName, speak]);

    /* ── Toggle panel ── */
    const toggle = useCallback(() => {
        if (!isOpen) {
            setIsOpen(true);
            // If already connected (minimized), just re-open
            // If not connected, show language picker (no auto-start)
        } else {
            setIsOpen(false);
        }
    }, [isOpen]);

    /* ── Cleanup on unmount ── */
    useEffect(() => {
        return () => {
            disconnect();
        };
    }, [disconnect]);

    /* ── Render ── */

    // Auth gate: don't show bubble at all if not authenticated
    if (!isAuthenticated) return null;

    return (
        <>
            {/* Floating bubble */}
            {!isOpen && (
                <button
                    onClick={toggle}
                    className="fixed bottom-6 right-6 z-50 w-16 h-16 rounded-full shadow-lg flex items-center justify-center transition-all hover:scale-110 overflow-hidden border-2 border-indigo-500"
                    aria-label="Open voice assistant"
                >
                    <img src="/voice-agent-avatar.png" alt="Voice Assistant" className="w-full h-full object-cover" />
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
                            {selectedLanguage && (
                                <span className="text-xs bg-indigo-700 rounded-full px-2 py-0.5">
                                    {selectedLanguage === 'ar' ? '🇦🇪 AR' : '🇬🇧 EN'}
                                </span>
                            )}
                            {isProcessing && <Loader2 className="w-4 h-4 animate-spin" />}
                        </div>
                        <div className="flex items-center gap-2">
                            {/* Remaining time badge */}
                            <div className="flex items-center gap-1 bg-indigo-700 rounded-full px-2 py-0.5 text-xs">
                                <Timer className="w-3 h-3" />
                                <span>{Math.floor(remainingSeconds / 60)}:{String(remainingSeconds % 60).padStart(2, '0')}</span>
                            </div>
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

                    {/* Language Selection Screen */}
                    {!isConnected && (
                        <div className="flex-1 flex flex-col items-center justify-center px-6 py-8 gap-6">
                            <div className="text-center">
                                <Globe className="w-10 h-10 text-indigo-500 mx-auto mb-3" />
                                <h3 className="text-lg font-bold text-gray-900 dark:text-white">Choose Your Language</h3>
                                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">اختر لغتك المفضلة</p>
                            </div>
                            <div className="flex gap-4 w-full">
                                <button
                                    onClick={() => startSession('en')}
                                    className="flex-1 flex flex-col items-center gap-2 p-5 rounded-xl border-2 border-gray-200 dark:border-gray-600 hover:border-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-all group"
                                >
                                    <span className="text-3xl">🇬🇧</span>
                                    <span className="font-semibold text-gray-900 dark:text-white group-hover:text-indigo-600">English</span>
                                </button>
                                <button
                                    onClick={() => startSession('ar')}
                                    className="flex-1 flex flex-col items-center gap-2 p-5 rounded-xl border-2 border-gray-200 dark:border-gray-600 hover:border-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-all group"
                                >
                                    <span className="text-3xl">🇦🇪</span>
                                    <span className="font-semibold text-gray-900 dark:text-white group-hover:text-indigo-600">العربية</span>
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Waveform / Status area (only when connected) */}
                    {isConnected && (
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
                                            '🎙️ Tap the mic to speak'}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Chat log */}
                    {isConnected && (
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
                    )}

                    {/* Controls (only when connected) */}
                    {isConnected && (
                        <div className="px-4 py-3 border-t border-gray-200 dark:border-gray-700 flex items-center justify-center gap-3">
                            <button
                                onClick={() => handleTransfer()}
                                className="p-2 rounded-full text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                                title="Transfer to human"
                            >
                                <UserRoundPlus className="w-5 h-5" />
                            </button>

                            <button
                                onClick={isListening ? () => stopListening() : startListening}
                                disabled={isProcessing || isSpeaking || dailyLimitReached}
                                className={`p-4 rounded-full text-white transition-all ${isListening
                                    ? 'bg-red-500 hover:bg-red-600 animate-pulse'
                                    : isProcessing || isSpeaking || dailyLimitReached
                                        ? 'bg-gray-400 cursor-not-allowed'
                                        : 'bg-indigo-600 hover:bg-indigo-700'
                                    }`}
                                title={dailyLimitReached ? 'Daily limit reached' : isListening ? 'Stop recording' : 'Start recording'}
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
                    )}

                    {/* Daily limit warning */}
                    {dailyLimitReached && (
                        <div className="px-4 py-2 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-xs text-center font-medium">
                            Daily voice limit reached (5 min). Please try again tomorrow.
                        </div>
                    )}
                </div>
            )}
        </>
    );
}
