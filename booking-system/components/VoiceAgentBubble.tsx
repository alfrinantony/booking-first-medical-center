'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Mic, MicOff, PhoneOff, X, ChevronDown, Timer, Globe } from 'lucide-react';
import { useRestrictionsStore } from '@/lib/restrictions-store';
import { useAuthStore } from '@/lib/store';

import {
    LiveKitRoom,
    RoomAudioRenderer,
    useConnectionState,
    useRemoteParticipants,
    useLocalParticipant,
    useVoiceAssistant,
    useRoomContext,
} from '@livekit/components-react';
import { ConnectionState, RoomEvent } from 'livekit-client';

/* ─────────────────────────────────────────────
   Types
   ───────────────────────────────────────────── */

interface ChatMessage {
    role: 'user' | 'assistant';
    content: string;
}

/* ─────────────────────────────────────────────
   Inner component — runs inside LiveKitRoom context
   ───────────────────────────────────────────── */

function AgentSession({
    language,
    customerName,
    onDisconnect,
    remainingSeconds,
}: {
    language: 'en' | 'ar';
    customerName: string;
    onDisconnect: () => void;
    remainingSeconds: number;
}) {
    const connectionState = useConnectionState();
    const remoteParticipants = useRemoteParticipants();
    const { localParticipant } = useLocalParticipant();
    const room = useRoomContext();
    const [chatLog, setChatLog] = useState<ChatMessage[]>([]);
    const [isMuted, setIsMuted] = useState(false);
    const [agentStatus, setAgentStatus] = useState('Connecting...');
    const chatEndRef = useRef<HTMLDivElement>(null);
    const processedIdsRef = useRef<Set<string>>(new Set());

    // Voice assistant hook — provides agent state and transcriptions
    const voiceAssistant = useVoiceAssistant();

    // Auto-scroll
    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [chatLog]);

    // Update status based on connection and agent state
    useEffect(() => {
        if (connectionState === ConnectionState.Connected) {
            if (voiceAssistant.state === 'listening') {
                setAgentStatus('🎙️ Listening...');
            } else if (voiceAssistant.state === 'thinking') {
                setAgentStatus('💭 Thinking...');
            } else if (voiceAssistant.state === 'speaking') {
                setAgentStatus('🔊 Sofia is speaking...');
            } else if (remoteParticipants.length > 0) {
                setAgentStatus('Sofia is here — speak now');
            } else {
                setAgentStatus('Connected — waiting for Sofia...');
            }
        } else if (connectionState === ConnectionState.Disconnected) {
            setAgentStatus('Disconnected');
        }
    }, [connectionState, voiceAssistant.state, remoteParticipants.length]);

    // Process agent transcriptions → chat log
    useEffect(() => {
        if (voiceAssistant.agentTranscriptions && voiceAssistant.agentTranscriptions.length > 0) {
            for (const seg of voiceAssistant.agentTranscriptions) {
                if (seg.final && seg.text.trim() && !processedIdsRef.current.has(seg.id)) {
                    processedIdsRef.current.add(seg.id);
                    setChatLog(prev => [...prev, { role: 'assistant', content: seg.text.trim() }]);
                }
            }
        }
    }, [voiceAssistant.agentTranscriptions]);

    // Listen for ALL transcriptions via room — captures user speech
    useEffect(() => {
        if (!room) return;

        const handleTranscription = (segments: any[], participant: any) => {
            // Check if this is the local user's transcription (not the agent)
            const isUser = participant && localParticipant &&
                participant.identity === localParticipant.identity;

            if (isUser) {
                for (const seg of segments) {
                    const segId = seg.id || `user-${seg.text}-${seg.startTime}`;
                    if (seg.final && seg.text?.trim() && !processedIdsRef.current.has(segId)) {
                        processedIdsRef.current.add(segId);
                        setChatLog(prev => [...prev, { role: 'user', content: seg.text.trim() }]);
                    }
                }
            }
        };

        room.on(RoomEvent.TranscriptionReceived, handleTranscription);
        return () => { room.off(RoomEvent.TranscriptionReceived, handleTranscription); };
    }, [room, localParticipant]);

    // Toggle mic
    const toggleMute = useCallback(async () => {
        if (!localParticipant) return;
        const newMuted = !isMuted;
        await localParticipant.setMicrophoneEnabled(!newMuted);
        setIsMuted(newMuted);
    }, [isMuted, localParticipant]);

    const isConnected = connectionState === ConnectionState.Connected;

    return (
        <>
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 bg-indigo-600 text-white rounded-t-2xl">
                <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-400' : 'bg-yellow-400 animate-pulse'}`} />
                    <span className="font-semibold text-sm">Sofia · Voice Assistant</span>
                    <span className="text-xs bg-indigo-700 rounded-full px-2 py-0.5">
                        {language === 'ar' ? '🇦🇪 AR' : '🇬🇧 EN'}
                    </span>
                </div>
                <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1 bg-indigo-700 rounded-full px-2 py-0.5 text-xs">
                        <Timer className="w-3 h-3" />
                        <span>{Math.floor(remainingSeconds / 60)}:{String(remainingSeconds % 60).padStart(2, '0')}</span>
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
                        {voiceAssistant.state === 'speaking' && <span className="inline-block w-2 h-2 bg-green-500 rounded-full animate-pulse" />}
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
   Main bubble component
   ───────────────────────────────────────────── */

export default function VoiceAgentBubble() {
    const { isAuthenticated, user } = useAuthStore();
    const [isOpen, setIsOpen] = useState(false);
    const [isInCall, setIsInCall] = useState(false);
    const [selectedLanguage, setSelectedLanguage] = useState<'en' | 'ar' | null>(null);
    const [token, setToken] = useState('');
    const [serverUrl, setServerUrl] = useState('');
    const [dailyLimitReached, setDailyLimitReached] = useState(false);
    const [remainingSeconds, setRemainingSeconds] = useState(300);

    const DAILY_LIMIT_SECONDS = 300;
    const sessionStartRef = useRef<number>(0);
    const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

    const customerName = user?.name || '';

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
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            stream.getTracks().forEach(t => t.stop());

            // Get token — pass ALL user profile info so the agent doesn't re-ask
            const res = await fetch('/api/livekit-token', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    customerName: user?.name || '',
                    customerPhone: user?.phone || '',
                    customerGender: user?.gender || '',
                    customerDateOfBirth: user?.dateOfBirth || '',
                    customerEmail: user?.email || '',
                    language: lang,
                }),
            });

            if (!res.ok) throw new Error('Failed to get token');

            const data = await res.json();
            setToken(data.token);
            setServerUrl(data.url);
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
            console.error('[Sofia] Error:', err);
            alert('Failed to start call. Please allow microphone access and try again.');
        }
    }, [user]);

    /* ── End call ── */
    const endCall = useCallback(() => {
        if (sessionStartRef.current > 0) {
            const elapsed = Math.ceil((Date.now() - sessionStartRef.current) / 1000);
            addUsedSeconds(elapsed);
            sessionStartRef.current = 0;
        }
        if (countdownRef.current) {
            clearInterval(countdownRef.current);
            countdownRef.current = null;
        }
        setIsInCall(false);
        setToken('');
        setServerUrl('');
        setSelectedLanguage(null);
        setIsOpen(false);
    }, []);

    /* ── Toggle panel ── */
    const toggle = useCallback(() => {
        if (!isOpen) {
            if (user) {
                const clientId = user.phone || user.email || user.name || '';
                if (useRestrictionsStore.getState().isVoiceBlocked(clientId)) {
                    alert('Voice booking is not available for your account.');
                    return;
                }
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

                    {/* ── IN CALL: LiveKitRoom handles everything ── */}
                    {isInCall && token && serverUrl && selectedLanguage && (
                        <LiveKitRoom
                            serverUrl={serverUrl}
                            token={token}
                            connect={true}
                            audio={true}
                            video={false}
                            onDisconnected={endCall}
                            style={{ display: 'flex', flexDirection: 'column', flex: 1 }}
                        >
                            <RoomAudioRenderer />

                            <AgentSession
                                language={selectedLanguage}
                                customerName={customerName}
                                onDisconnect={endCall}
                                remainingSeconds={remainingSeconds}
                            />
                        </LiveKitRoom>
                    )}

                    {/* ── NOT IN CALL: Language selection ── */}
                    {!isInCall && (
                        <>
                            <div className="flex items-center justify-between px-4 py-3 bg-indigo-600 text-white rounded-t-2xl">
                                <div className="flex items-center gap-2">
                                    <div className="w-2 h-2 rounded-full bg-gray-400" />
                                    <span className="font-semibold text-sm">Sofia · Voice Assistant</span>
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
