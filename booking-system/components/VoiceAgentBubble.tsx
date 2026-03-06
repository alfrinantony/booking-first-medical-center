'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Mic, MicOff, PhoneOff, X, ChevronDown, Loader2, Timer, Globe } from 'lucide-react';
import { useRestrictionsStore } from '@/lib/restrictions-store';
import { useAuthStore } from '@/lib/store';

import {
    Room,
    RoomEvent,
    Track,
    RemoteTrackPublication,
    RemoteParticipant,
    ConnectionState,
} from 'livekit-client';

/* ─────────────────────────────────────────────
   Types
   ───────────────────────────────────────────── */

interface ChatMessage {
    role: 'user' | 'assistant';
    content: string;
}

/* ─────────────────────────────────────────────
   VoiceAgentBubble — LiveKit Agent Version
   Connects to LiveKit Cloud agent via WebRTC
   ───────────────────────────────────────────── */

export default function VoiceAgentBubble() {
    const { isAuthenticated, user } = useAuthStore();
    const [isOpen, setIsOpen] = useState(false);
    const [isConnected, setIsConnected] = useState(false);
    const [isConnecting, setIsConnecting] = useState(false);
    const [isMuted, setIsMuted] = useState(false);
    const [chatLog, setChatLog] = useState<ChatMessage[]>([]);
    const [agentStatus, setAgentStatus] = useState<string>('');
    const [dailyLimitReached, setDailyLimitReached] = useState(false);
    const [remainingSeconds, setRemainingSeconds] = useState(300);
    const [transcriptText, setTranscriptText] = useState('');

    const DAILY_LIMIT_SECONDS = 300;

    // Refs
    const roomRef = useRef<Room | null>(null);
    const chatEndRef = useRef<HTMLDivElement>(null);
    const audioRef = useRef<HTMLAudioElement>(null);
    const sessionStartRef = useRef<number>(0);
    const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

    // Customer info
    const customerName = user?.name || '';

    // ── Daily usage tracking ──
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

    // Auto-scroll chat
    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [chatLog]);

    /* ── Connect to LiveKit Room ── */
    const connect = useCallback(async () => {
        if (isConnected || isConnecting || dailyLimitReached) return;

        setIsConnecting(true);
        setAgentStatus('Connecting...');

        try {
            // 1. Get token from our API
            const tokenRes = await fetch('/api/livekit-token', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    customerName,
                    customerPhone: user?.phone || '',
                }),
            });

            if (!tokenRes.ok) {
                const err = await tokenRes.json();
                throw new Error(err.error || 'Failed to get token');
            }

            const { token, url } = await tokenRes.json();

            // 2. Create and connect to LiveKit Room
            const room = new Room({
                adaptiveStream: true,
                dynacast: true,
            });

            roomRef.current = room;

            // Listen for agent audio tracks
            room.on(RoomEvent.TrackSubscribed, (track, publication: RemoteTrackPublication, participant: RemoteParticipant) => {
                if (track.kind === Track.Kind.Audio) {
                    // Attach agent audio to our <audio> element
                    const audioElement = audioRef.current;
                    if (audioElement) {
                        track.attach(audioElement);
                    }
                }
            });

            // Listen for data messages (transcriptions, chat)
            room.on(RoomEvent.DataReceived, (payload: Uint8Array, participant?: RemoteParticipant) => {
                try {
                    const text = new TextDecoder().decode(payload);
                    const data = JSON.parse(text);

                    // Handle transcription events from the agent
                    if (data.type === 'transcription' || data.transcript) {
                        const transcript = data.transcript || data.text || '';
                        const isFinal = data.is_final !== false;

                        if (isFinal && transcript.trim()) {
                            if (data.participant_identity && !data.participant_identity.includes('agent')) {
                                // User transcription
                                setChatLog(prev => [...prev, { role: 'user', content: transcript }]);
                            } else {
                                // Agent transcription
                                setChatLog(prev => [...prev, { role: 'assistant', content: transcript }]);
                            }
                        } else if (!isFinal) {
                            setTranscriptText(transcript);
                        }
                    }
                } catch {
                    // Not JSON, ignore
                }
            });

            // Track agent joining
            room.on(RoomEvent.ParticipantConnected, (participant: RemoteParticipant) => {
                const meta = participant.metadata;
                if (participant.identity.includes('agent') || (meta && meta.includes('agent'))) {
                    setAgentStatus('Sofia is ready');
                    const greeting: ChatMessage = {
                        role: 'assistant',
                        content: `Hello${customerName ? ` ${customerName.split(' ')[0]}` : ''}! I'm Sofia, your booking assistant. How may I help you today?`,
                    };
                    setChatLog(prev => {
                        if (prev.length === 0) return [greeting];
                        return prev;
                    });
                }
            });

            // Connection state changes
            room.on(RoomEvent.ConnectionStateChanged, (state: ConnectionState) => {
                if (state === ConnectionState.Connected) {
                    setIsConnected(true);
                    setIsConnecting(false);
                    setAgentStatus('Connected — speak to Sofia');
                    sessionStartRef.current = Date.now();

                    // Start countdown timer
                    countdownRef.current = setInterval(() => {
                        const elapsed = Math.ceil((Date.now() - sessionStartRef.current) / 1000);
                        const remaining = Math.max(0, DAILY_LIMIT_SECONDS - getUsedSeconds() - elapsed);
                        setRemainingSeconds(remaining);
                        if (remaining <= 0) {
                            disconnect();
                        }
                    }, 1000);
                } else if (state === ConnectionState.Disconnected) {
                    setIsConnected(false);
                    setAgentStatus('Disconnected');
                }
            });

            room.on(RoomEvent.Disconnected, () => {
                setIsConnected(false);
                setIsConnecting(false);
                setAgentStatus('Session ended');
            });

            // 3. Connect to the room with mic enabled
            await room.connect(url, token);

            // 4. Publish local microphone
            await room.localParticipant.setMicrophoneEnabled(true);

        } catch (err) {
            console.error('[VoiceAgent] Connection error:', err);
            setAgentStatus(`Error: ${err instanceof Error ? err.message : 'Connection failed'}`);
            setIsConnecting(false);
        }
    }, [isConnected, isConnecting, dailyLimitReached, customerName, user?.phone]);

    /* ── Disconnect ── */
    const disconnect = useCallback(() => {
        // Track usage
        if (sessionStartRef.current > 0) {
            const elapsed = Math.ceil((Date.now() - sessionStartRef.current) / 1000);
            addUsedSeconds(elapsed);
            sessionStartRef.current = 0;
        }

        if (countdownRef.current) {
            clearInterval(countdownRef.current);
            countdownRef.current = null;
        }

        // Email transcript (fire-and-forget)
        if (chatLog.length > 1) {
            const authState = useAuthStore.getState();
            fetch('/api/voice-agent/email-transcript', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    chatLog,
                    patientName: authState.user?.name || 'Unknown',
                    patientPhone: authState.user?.phone || 'N/A',
                    timestamp: new Date().toISOString(),
                }),
            }).catch(err => console.warn('[VoiceAgent] Email send failed:', err));
        }

        if (roomRef.current) {
            roomRef.current.disconnect();
            roomRef.current = null;
        }

        setIsConnected(false);
        setIsConnecting(false);
        setIsOpen(false);
        setChatLog([]);
        setTranscriptText('');
        setIsMuted(false);
        setAgentStatus('');
    }, [chatLog]);

    /* ── Toggle mic ── */
    const toggleMute = useCallback(async () => {
        const room = roomRef.current;
        if (!room) return;

        const newMuted = !isMuted;
        await room.localParticipant.setMicrophoneEnabled(!newMuted);
        setIsMuted(newMuted);
    }, [isMuted]);

    /* ── Toggle panel ── */
    const toggle = useCallback(() => {
        if (!isOpen) {
            // Check voice agent block
            if (user) {
                const clientId = user.phone || user.email || user.name || '';
                if (useRestrictionsStore.getState().isVoiceBlocked(clientId)) {
                    alert('Voice booking is not available for your account. Please use the online booking portal or contact the clinic.');
                    return;
                }
            }
            setIsOpen(true);
        } else {
            setIsOpen(false);
        }
    }, [isOpen, user]);

    /* ── Cleanup on unmount ── */
    useEffect(() => {
        return () => {
            if (roomRef.current) {
                roomRef.current.disconnect();
            }
            if (countdownRef.current) {
                clearInterval(countdownRef.current);
            }
        };
    }, []);

    // Auth gate
    if (!isAuthenticated) return null;

    return (
        <>
            {/* Hidden audio element for agent voice */}
            <audio ref={audioRef} autoPlay playsInline />

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

            {/* Expanded panel */}
            {isOpen && (
                <div className="fixed bottom-6 right-6 z-50 w-[380px] max-h-[520px] bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 flex flex-col overflow-hidden">
                    {/* Header */}
                    <div className="flex items-center justify-between px-4 py-3 bg-indigo-600 text-white rounded-t-2xl">
                        <div className="flex items-center gap-2">
                            <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-400' : isConnecting ? 'bg-yellow-400 animate-pulse' : 'bg-gray-400'}`} />
                            <span className="font-semibold text-sm">Sofia · Voice Assistant</span>
                            {isConnecting && <Loader2 className="w-4 h-4 animate-spin" />}
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="flex items-center gap-1 bg-indigo-700 rounded-full px-2 py-0.5 text-xs">
                                <Timer className="w-3 h-3" />
                                <span>{Math.floor(remainingSeconds / 60)}:{String(remainingSeconds % 60).padStart(2, '0')}</span>
                            </div>
                            <button onClick={() => setIsOpen(false)} className="p-1 hover:bg-indigo-700 rounded" aria-label="Minimize">
                                <ChevronDown className="w-4 h-4" />
                            </button>
                            <button onClick={disconnect} className="p-1 hover:bg-indigo-700 rounded" aria-label="Close">
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                    </div>

                    {/* Not connected: Start button */}
                    {!isConnected && !isConnecting && (
                        <div className="flex-1 flex flex-col items-center justify-center px-6 py-8 gap-5">
                            <div className="w-20 h-20 rounded-full overflow-hidden border-3 border-indigo-200 shadow-lg">
                                <img src="/voice-agent-avatar.png" alt="Sofia" className="w-full h-full object-cover" />
                            </div>
                            <div className="text-center">
                                <h3 className="text-lg font-bold text-gray-900 dark:text-white">Talk to Sofia</h3>
                                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Your AI booking assistant</p>
                            </div>
                            {dailyLimitReached ? (
                                <p className="text-sm text-red-500 text-center">Daily voice limit reached. Try again tomorrow.</p>
                            ) : (
                                <button
                                    onClick={connect}
                                    className="flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-xl font-semibold hover:bg-indigo-700 transition-all hover:scale-105 shadow-lg"
                                >
                                    <Mic className="w-5 h-5" />
                                    Start Call
                                </button>
                            )}
                        </div>
                    )}

                    {/* Connecting */}
                    {isConnecting && (
                        <div className="flex-1 flex flex-col items-center justify-center px-6 py-8 gap-4">
                            <Loader2 className="w-10 h-10 text-indigo-500 animate-spin" />
                            <p className="text-sm text-gray-500 dark:text-gray-400">{agentStatus}</p>
                        </div>
                    )}

                    {/* Connected: Status bar */}
                    {isConnected && (
                        <div className="px-4 py-2 bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
                            <div className="flex items-center justify-between">
                                <span className="text-xs text-gray-500 dark:text-gray-400">{agentStatus}</span>
                                {transcriptText && (
                                    <span className="text-xs text-indigo-500 italic truncate max-w-[200px]">{transcriptText}</span>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Chat log */}
                    {isConnected && (
                        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 min-h-[200px] max-h-[280px]">
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
                    )}

                    {/* Controls */}
                    {isConnected && (
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
                                onClick={disconnect}
                                className="p-3 rounded-full bg-red-500 text-white hover:bg-red-600 transition-all"
                                aria-label="End call"
                            >
                                <PhoneOff className="w-5 h-5" />
                            </button>
                        </div>
                    )}
                </div>
            )}
        </>
    );
}
