'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Mic, MicOff, PhoneOff, X, Timer, Globe } from 'lucide-react';
import { useAuthStore } from '@/lib/store';

/* ─────────────────────────────────────────────
   Types
   ───────────────────────────────────────────── */

interface ChatMessage {
    role: 'user' | 'assistant';
    content: string;
}

/* ─────────────────────────────────────────────
   Constants
   ───────────────────────────────────────────── */
const DAILY_LIMIT_SECONDS = 300;
const OPENAI_REALTIME_BASE = 'https://api.openai.com/v1/realtime';
const REALTIME_MODEL = 'gpt-4o-realtime-preview';

/* ─────────────────────────────────────────────
   Inner component — Active call session
   ───────────────────────────────────────────── */

function ActiveCallSession({
    language,
    clientSecret,
    onDisconnect,
    remainingSeconds: initialRemaining,
    chatLog,
    setChatLog,
}: {
    language: 'en' | 'ar';
    clientSecret: string;
    onDisconnect: () => void;
    remainingSeconds: number;
    chatLog: ChatMessage[];
    setChatLog: React.Dispatch<React.SetStateAction<ChatMessage[]>>;
}) {
    const [isMuted, setIsMuted] = useState(false);
    const [agentStatus, setAgentStatus] = useState('Connecting...');
    const [remaining, setRemaining] = useState(initialRemaining);
    const chatEndRef = useRef<HTMLDivElement>(null);
    const pcRef = useRef<RTCPeerConnection | null>(null);
    const dcRef = useRef<RTCDataChannel | null>(null);
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const startTimeRef = useRef(Date.now());
    const agentTextBuffer = useRef('');
    const userTextBuffer = useRef('');

    // Auto-scroll
    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [chatLog]);

    // Countdown timer
    useEffect(() => {
        const interval = setInterval(() => {
            const elapsed = Math.floor((Date.now() - startTimeRef.current) / 1000);
            const left = Math.max(0, initialRemaining - elapsed);
            setRemaining(left);
            if (left <= 0) {
                clearInterval(interval);
                onDisconnect();
            }
        }, 1000);
        return () => clearInterval(interval);
    }, [initialRemaining, onDisconnect]);

    // Establish WebRTC connection
    useEffect(() => {
        let cancelled = false;

        async function connect() {
            try {
                // Create peer connection
                const pc = new RTCPeerConnection();
                pcRef.current = pc;

                // Set up remote audio playback
                const audioEl = new Audio();
                audioEl.autoplay = true;
                audioRef.current = audioEl;

                pc.ontrack = (e) => {
                    audioEl.srcObject = e.streams[0];
                };

                // Get local microphone
                const stream = await navigator.mediaDevices.getUserMedia({ 
                    audio: {
                        echoCancellation: true,
                        noiseSuppression: true,
                        autoGainControl: true,
                    }
                });
                streamRef.current = stream;
                stream.getTracks().forEach((track) => {
                    pc.addTrack(track, stream);
                });

                // Create data channel for events
                const dc = pc.createDataChannel('oai-events');
                dcRef.current = dc;

                dc.onopen = () => {
                    if (cancelled) return;
                    setAgentStatus('Connected — speak now');

                    // Send a response.create to have the agent greet
                    dc.send(JSON.stringify({
                        type: 'response.create',
                        response: {
                            modalities: ['audio', 'text'],
                            instructions: 'Greet the visitor warmly. Say something like: "Hello! Welcome to First Medical Center. I am Sofia, your virtual booking assistant. How can I help you today?" Keep it brief and friendly.'
                                + (language === 'ar' ? ' Greet in Arabic.' : ''),
                        },
                    }));
                };

                dc.onmessage = (e) => {
                    try {
                        const event = JSON.parse(e.data);
                        handleRealtimeEvent(event);
                    } catch {
                        // ignore parse errors
                    }
                };

                // Create and set local offer
                const offer = await pc.createOffer();
                await pc.setLocalDescription(offer);

                // Send offer to OpenAI Realtime via HTTP
                const sdpResponse = await fetch(
                    `${OPENAI_REALTIME_BASE}?model=${REALTIME_MODEL}`,
                    {
                        method: 'POST',
                        headers: {
                            'Authorization': `Bearer ${clientSecret}`,
                            'Content-Type': 'application/sdp',
                        },
                        body: offer.sdp,
                    }
                );

                if (!sdpResponse.ok) {
                    throw new Error(`SDP exchange failed: ${sdpResponse.status}`);
                }

                const answerSdp = await sdpResponse.text();
                await pc.setRemoteDescription({
                    type: 'answer',
                    sdp: answerSdp,
                });

                setAgentStatus('Connected — Sofia is ready');
            } catch (err) {
                console.error('[CallCenter] WebRTC error:', err);
                setAgentStatus('Connection failed');
                if (!cancelled) {
                    setTimeout(onDisconnect, 2000);
                }
            }
        }

        function handleRealtimeEvent(event: Record<string, unknown>) {
            const type = event.type as string;

            // Agent speaking states
            if (type === 'response.audio.delta') {
                setAgentStatus('🔊 Sofia is speaking...');
            }

            // Agent text transcript (delta)
            if (type === 'response.audio_transcript.delta') {
                agentTextBuffer.current += (event.delta as string) || '';
            }

            // Agent text transcript (done)
            if (type === 'response.audio_transcript.done') {
                const text = (event.transcript as string) || agentTextBuffer.current;
                if (text.trim()) {
                    setChatLog((prev) => [...prev, { role: 'assistant', content: text.trim() }]);
                }
                agentTextBuffer.current = '';
            }

            // User speech transcript (delta)
            if (type === 'conversation.item.input_audio_transcription.delta') {
                userTextBuffer.current += (event.delta as string) || '';
            }

            // User speech transcript (completed)
            if (type === 'conversation.item.input_audio_transcription.completed') {
                const text = (event.transcript as string) || userTextBuffer.current;
                if (text.trim()) {
                    setChatLog((prev) => [...prev, { role: 'user', content: text.trim() }]);
                }
                userTextBuffer.current = '';
            }

            // Input audio started (user is speaking)
            if (type === 'input_audio_buffer.speech_started') {
                setAgentStatus('🎙️ Listening...');
            }

            // Input audio stopped
            if (type === 'input_audio_buffer.speech_stopped') {
                setAgentStatus('💭 Thinking...');
            }

            // Response done
            if (type === 'response.done') {
                setAgentStatus('Sofia is here — speak now');
            }


            // Function calling
            if (type === 'response.function_call_arguments.done') {
                const { call_id, name, arguments: argsString } = event;
                setAgentStatus('Checking ' + name + '...');
                setChatLog((prev) => [...prev, { role: 'assistant', content: `[SYSTEM] Triggered ${name}` }]);
                
                try {
                    const argsObj = JSON.parse(argsString as string);
                    
                    fetch('/api/call-center/tools', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            tool: name as string,
                            args: argsObj,
                            customerName: user?.name,
                            customerPhone: user?.phone,
                            customerEmail: user?.email,
                            customerGender: user?.gender
                        })
                    }).then(res => {
                        if (!res.ok) throw new Error('HTTP ' + res.status);
                        return res.json();
                    }).then(result => {
                        if (dcRef.current) {
                            dcRef.current.send(JSON.stringify({
                                type: 'conversation.item.create',
                                item: {
                                    type: 'function_call_output',
                                    call_id: call_id,
                                    output: JSON.stringify(result)
                                }
                            }));
                            dcRef.current.send(JSON.stringify({ type: 'response.create' }));
                        }
                    }).catch(err => {
                        setChatLog((prev) => [...prev, { role: 'assistant', content: `[SYSTEM] Fetch Error ${name}: ${err.message}` }]);
                        if (dcRef.current) {
                            dcRef.current.send(JSON.stringify({
                                type: 'conversation.item.create',
                                item: {
                                    type: 'function_call_output',
                                    call_id: call_id,
                                    output: JSON.stringify({ success: false, message: 'Tool execution failed: ' + err.message })
                                }
                            }));
                            dcRef.current.send(JSON.stringify({ type: 'response.create' }));
                        }
                    });
                } catch (e: any) {
                    setAgentStatus('Parse Error: ' + e.message); 
                    setChatLog((prev) => [...prev, {role: 'assistant', content: `[SYSTEM] Parse Error ${name}: ${e.message}`}]); 
                    if (dcRef.current) {
                        dcRef.current.send(JSON.stringify({
                            type: 'conversation.item.create',
                            item: {
                                type: 'function_call_output',
                                call_id: call_id,
                                output: JSON.stringify({ success: false, message: 'Invalid arguments format.' })
                            }
                        }));
                        dcRef.current.send(JSON.stringify({ type: 'response.create' }));
                    }
                }
            }

            // Errors
            if (type === 'error') {
                console.error('[CallCenter] Realtime error:', event);
                setAgentStatus('Error occurred');
            }
        }

        connect();

        return () => {
            cancelled = true;
            // Cleanup
            if (dcRef.current) {
                dcRef.current.close();
                dcRef.current = null;
            }
            if (pcRef.current) {
                pcRef.current.close();
                pcRef.current = null;
            }
            if (streamRef.current) {
                streamRef.current.getTracks().forEach((t) => t.stop());
                streamRef.current = null;
            }
            if (audioRef.current) {
                audioRef.current.srcObject = null;
                audioRef.current = null;
            }
        };
    }, [clientSecret, language, onDisconnect]);

    // Toggle mic
    const toggleMute = useCallback(() => {
        if (!streamRef.current) return;
        const newMuted = !isMuted;
        streamRef.current.getAudioTracks().forEach((t) => {
            t.enabled = !newMuted;
        });
        setIsMuted(newMuted);
    }, [isMuted]);

    const minutes = Math.floor(remaining / 60);
    const seconds = remaining % 60;

    return (
        <>
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 bg-indigo-600 text-white rounded-t-2xl">
                <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                    <span className="font-semibold text-sm">Sofia · Call Center</span>
                    <span className="text-xs bg-indigo-700 rounded-full px-2 py-0.5">
                        {language === 'ar' ? '🇦🇪 AR' : '🇬🇧 EN'}
                    </span>
                </div>
                <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1 bg-indigo-700 rounded-full px-2 py-0.5 text-xs">
                        <Timer className="w-3 h-3" />
                        <span>{String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}</span>
                    </div>
                    <button onClick={onDisconnect} className="p-1 hover:bg-indigo-700 rounded" aria-label="Close">
                        <X className="w-4 h-4" />
                    </button>
                </div>
            </div>

            {/* Status */}
            <div className="px-4 py-2 bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
                <div className="flex items-center justify-between">
                    <span className="text-xs text-green-600 font-medium flex items-center gap-1">
                        {agentStatus.includes('speaking') && <span className="inline-block w-2 h-2 bg-green-500 rounded-full animate-pulse" />}
                        {agentStatus}
                    </span>
                    {isMuted && <span className="text-xs text-red-500 font-medium">🔇 Muted</span>}
                </div>
            </div>

            {/* Chat */}
            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 min-h-[200px] max-h-[280px]">
                {chatLog.length === 0 && (
                    <div className="text-center text-sm text-gray-400 py-8">
                        🎙️ Start speaking — Sofia is listening...
                    </div>
                )}
                {chatLog.map((msg, i) => (
                    <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[80%] px-3 py-2 rounded-xl text-sm ${msg.role === 'user'
                            ? 'bg-indigo-600 text-white rounded-br-sm'
                            : 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-bl-sm'
                            }`}>
                            {msg.content}
                        </div>
                    </div>
                ))}
                <div ref={chatEndRef} />
            </div>

            {/* Controls */}
            <div className="px-4 py-3 border-t border-gray-200 dark:border-gray-700 flex items-center justify-center gap-4">
                <button
                    onClick={toggleMute}
                    className={`p-3 rounded-full transition-all ${isMuted
                        ? 'bg-red-100 dark:bg-red-900/30 text-red-600 hover:bg-red-200'
                        : 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 hover:bg-indigo-200'
                        }`}
                    aria-label={isMuted ? 'Unmute' : 'Mute'}
                >
                    {isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
                </button>
                <button
                    onClick={onDisconnect}
                    className="p-3 rounded-full bg-red-500 text-white hover:bg-red-600 transition-all"
                    aria-label="End call"
                >
                    <PhoneOff className="w-5 h-5" />
                </button>
            </div>
        </>
    );
}

/* ─────────────────────────────────────────────
   Main CallCenterAgent component
   ───────────────────────────────────────────── */

export default function CallCenterAgent() {
    const { isAuthenticated, user } = useAuthStore();
    const [isOpen, setIsOpen] = useState(false);
    const [isInCall, setIsInCall] = useState(false);
    const [selectedLanguage, setSelectedLanguage] = useState<'en' | 'ar' | null>(null);
    const [clientSecret, setClientSecret] = useState('');
    const [dailyLimitReached, setDailyLimitReached] = useState(false);
    const [remainingSeconds, setRemainingSeconds] = useState(DAILY_LIMIT_SECONDS);
    const [chatLog, setChatLog] = useState<ChatMessage[]>([]);

    const sessionStartRef = useRef<number>(0);
    const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const chatLogRef = useRef<ChatMessage[]>([]);

    useEffect(() => {
        chatLogRef.current = chatLog;
    }, [chatLog]);

    // Daily usage
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

    useEffect(() => {
        const used = getUsedSeconds();
        const remaining = Math.max(0, DAILY_LIMIT_SECONDS - used);
        setRemainingSeconds(remaining);
        if (remaining <= 0) setDailyLimitReached(true);
    }, [user?.phone]); // eslint-disable-line react-hooks/exhaustive-deps

    /* ── Start call ── */
    const startCall = useCallback(async (lang: 'en' | 'ar') => {
        setSelectedLanguage(lang);

        try {
            // Request mic permission first (user gesture context)
            const stream = await navigator.mediaDevices.getUserMedia({ 
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true,
                }
            });
            stream.getTracks().forEach((t) => t.stop());

            // Get ephemeral session token from our backend
            const res = await fetch('/api/call-center/session', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    customerName: user?.name || '',
                    customerPhone: user?.phone || '',
                    customerGender: user?.gender || '',
                    customerAge: user?.dateOfBirth
                        ? String(Math.floor((Date.now() - new Date(user.dateOfBirth).getTime()) / (365.25 * 24 * 60 * 60 * 1000)))
                        : '',
                    customerEmail: user?.email || '',
                    language: lang,
                }),
            });

            if (!res.ok) throw new Error('Failed to create session');

            const data = await res.json();
            if (!data.clientSecret) throw new Error('No client secret returned');

            setClientSecret(data.clientSecret);
            setIsInCall(true);

            // Start timer
            sessionStartRef.current = Date.now();
            countdownRef.current = setInterval(() => {
                const elapsed = Math.ceil((Date.now() - sessionStartRef.current) / 1000);
                const remaining = Math.max(0, DAILY_LIMIT_SECONDS - getUsedSeconds() - elapsed);
                setRemainingSeconds(remaining);
                if (remaining <= 0) endCall();
            }, 1000);
        } catch (err) {
            console.error('[CallCenter] Error:', err);
            alert('Failed to start call. Please allow microphone access and try again.');
        }
    }, [user]); // eslint-disable-line react-hooks/exhaustive-deps

    /* ── Submit call summary ── */
    const submitCallSummary = async (durationSeconds: number) => {
        const currentLog = chatLogRef.current;
        if (currentLog.length === 0) return;
        const transcript = currentLog
            .map(m => `${m.role === 'user' ? 'Customer' : 'Sofia'}: ${m.content}`)
            .join('\n');
        try {
            await fetch('/api/admin/call-agent-summaries', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    customerId: user?.phone || `anonymous-${Date.now()}`,
                    customerName: user?.name || 'Anonymous',
                    customerNumber: user?.phone || '',
                    summary: transcript,
                    callDuration: durationSeconds,
                    timestamp: new Date().toISOString(),
                    branch: 'Booking Page — Call Center',
                }),
            });
        } catch (e) {
            console.error('[CallCenter] Failed to submit call summary:', e);
        }
    };

    /* ── End call ── */
    const endCall = useCallback(() => {
        let elapsed = 0;
        if (sessionStartRef.current > 0) {
            elapsed = Math.ceil((Date.now() - sessionStartRef.current) / 1000);
            addUsedSeconds(elapsed);
            sessionStartRef.current = 0;
        }
        if (countdownRef.current) {
            clearInterval(countdownRef.current);
            countdownRef.current = null;
        }
        // Submit summary before clearing state
        submitCallSummary(elapsed);
        setChatLog([]);
        setIsInCall(false);
        setClientSecret('');
        setSelectedLanguage(null);
        setIsOpen(false);
    }, [user]); // Removed chatLog dependency to prevent WebRTC infinite restarts

    /* ── Toggle panel ── */
    const toggle = useCallback(async () => {
        if (!isOpen) {
            if (user) {
                const clientId = user.phone || user.email || user.name || '';
                try {
                    const res = await fetch('/api/admin/restrictions', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ action: 'isVoiceBlocked', clientId }),
                    });
                    const data = await res.json();
                    if (data.blocked) {
                        alert('Voice booking is not available for your account.');
                        return;
                    }
                } catch { /* allow if API fails */ }
            }
            setIsOpen(true);
        } else if (!isInCall) {
            setIsOpen(false);
        }
    }, [isOpen, isInCall, user]);

    useEffect(() => {
        return () => {
            if (countdownRef.current) clearInterval(countdownRef.current);
        };
    }, []);

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
                    <img src="/voice-agent-avatar.png" alt="Sofia" className="w-full h-full object-cover" />
                    <span className="absolute inset-0 rounded-full bg-indigo-400 animate-ping opacity-30" />
                </button>
            )}

            {/* Panel */}
            {isOpen && (
                <div className="fixed bottom-6 right-6 z-50 w-[380px] max-h-[520px] bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 flex flex-col overflow-hidden">

                    {/* ── IN CALL: Active session ── */}
                    {isInCall && clientSecret && selectedLanguage && (
                        <ActiveCallSession
                            language={selectedLanguage}
                            clientSecret={clientSecret}
                            onDisconnect={endCall}
                            remainingSeconds={remainingSeconds}
                            chatLog={chatLog}
                            setChatLog={setChatLog}
                        />
                    )}

                    {/* ── NOT IN CALL: Language selection ── */}
                    {!isInCall && (
                        <>
                            <div className="flex items-center justify-between px-4 py-3 bg-indigo-600 text-white rounded-t-2xl">
                                <div className="flex items-center gap-2">
                                    <div className="w-2 h-2 rounded-full bg-gray-400" />
                                    <span className="font-semibold text-sm">Sofia · Call Center</span>
                                </div>
                                <button onClick={() => setIsOpen(false)} className="p-1 hover:bg-indigo-700 rounded">
                                    <X className="w-4 h-4" />
                                </button>
                            </div>

                            <div className="flex-1 flex flex-col items-center justify-center px-6 py-8 gap-6">
                                <div className="w-20 h-20 rounded-full overflow-hidden border-3 border-indigo-200 shadow-lg">
                                    <img src="/voice-agent-avatar.png" alt="Sofia" className="w-full h-full object-cover" />
                                </div>
                                <div className="text-center">
                                    <Globe className="w-8 h-8 text-indigo-500 mx-auto mb-2" />
                                    <h3 className="text-lg font-bold text-gray-900 dark:text-white">Choose Your Language</h3>
                                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">اختر لغتك المفضلة</p>
                                </div>
                                {dailyLimitReached ? (
                                    <p className="text-sm text-red-500 text-center">Daily limit reached. Try again tomorrow.</p>
                                ) : (
                                    <div className="flex gap-4 w-full">
                                        <button
                                            onClick={() => startCall('en')}
                                            className="flex-1 flex flex-col items-center gap-2 p-5 rounded-xl border-2 border-gray-200 dark:border-gray-600 hover:border-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-all group"
                                        >
                                            <span className="text-3xl">🇬🇧</span>
                                            <span className="font-semibold text-gray-900 dark:text-white group-hover:text-indigo-600">English</span>
                                        </button>
                                        <button
                                            onClick={() => startCall('ar')}
                                            className="flex-1 flex flex-col items-center gap-2 p-5 rounded-xl border-2 border-gray-200 dark:border-gray-600 hover:border-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-all group"
                                        >
                                            <span className="text-3xl">🇦🇪</span>
                                            <span className="font-semibold text-gray-900 dark:text-white group-hover:text-indigo-600">العربية</span>
                                        </button>
                                    </div>
                                )}
                            </div>
                        </>
                    )}
                </div>
            )}
        </>
    );
}
