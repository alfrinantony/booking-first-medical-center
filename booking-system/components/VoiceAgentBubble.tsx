'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Mic, MicOff, PhoneOff, X, ChevronDown, Loader2, Timer } from 'lucide-react';
import { useRestrictionsStore } from '@/lib/restrictions-store';
import { useAuthStore } from '@/lib/store';

import {
    Room,
    RoomEvent,
    Track,
    RemoteTrackPublication,
    RemoteParticipant,
    ConnectionState,
    DisconnectReason,
} from 'livekit-client';

/* ─────────────────────────────────────────────
   Types
   ───────────────────────────────────────────── */

interface ChatMessage {
    role: 'user' | 'assistant';
    content: string;
}

/* ─────────────────────────────────────────────
   VoiceAgentBubble — LiveKit Cloud Agent
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
    const [isSpeaking, setIsSpeaking] = useState(false);

    const DAILY_LIMIT_SECONDS = 300;

    // Refs
    const roomRef = useRef<Room | null>(null);
    const chatEndRef = useRef<HTMLDivElement>(null);
    const audioContainerRef = useRef<HTMLDivElement>(null);
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

    // Auto-scroll
    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [chatLog]);

    /* ── Connect to LiveKit Room ── */
    const connect = useCallback(async () => {
        if (isConnected || isConnecting || dailyLimitReached) return;

        setIsConnecting(true);
        setAgentStatus('Connecting...');
        console.log('[Sofia] Starting connection...');

        try {
            // 1. Get token
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
            console.log('[Sofia] Token received, connecting to:', url);

            // 2. Create Room
            const room = new Room({
                adaptiveStream: true,
                dynacast: true,
                audioCaptureDefaults: {
                    autoGainControl: true,
                    echoCancellation: true,
                    noiseSuppression: true,
                },
            });

            roomRef.current = room;

            // ── EVENT: Agent audio track subscribed ──
            room.on(RoomEvent.TrackSubscribed, (track, publication: RemoteTrackPublication, participant: RemoteParticipant) => {
                console.log('[Sofia] Track subscribed:', track.kind, 'from:', participant.identity);

                if (track.kind === Track.Kind.Audio) {
                    // Use track.attach() which creates and returns a proper HTMLMediaElement
                    const el = track.attach();
                    el.setAttribute('autoplay', 'true');
                    el.setAttribute('playsinline', 'true');
                    el.volume = 1.0;

                    // Append to hidden container in DOM
                    if (audioContainerRef.current) {
                        audioContainerRef.current.appendChild(el);
                    } else {
                        document.body.appendChild(el);
                    }

                    console.log('[Sofia] Agent audio attached and playing');
                    setIsSpeaking(true);
                }
            });

            // ── EVENT: Track unsubscribed ──
            room.on(RoomEvent.TrackUnsubscribed, (track) => {
                track.detach().forEach(el => el.remove());
                if (track.kind === Track.Kind.Audio) {
                    setIsSpeaking(false);
                }
            });

            // ── EVENT: Agent joins ──
            room.on(RoomEvent.ParticipantConnected, (participant: RemoteParticipant) => {
                console.log('[Sofia] Participant joined:', participant.identity, 'metadata:', participant.metadata);
                setAgentStatus('Sofia is here — speak now');
            });

            // ── EVENT: Data messages (transcriptions) ──
            room.on(RoomEvent.DataReceived, (payload: Uint8Array, participant?: RemoteParticipant) => {
                try {
                    const text = new TextDecoder().decode(payload);
                    const data = JSON.parse(text);
                    console.log('[Sofia] Data received:', data);

                    if (data.type === 'transcription' || data.transcript) {
                        const transcript = data.transcript || data.text || '';
                        const isFinal = data.is_final !== false;

                        if (isFinal && transcript.trim()) {
                            const isAgent = participant && (
                                participant.identity.includes('agent') ||
                                participant.identity.includes('CA_')
                            );
                            setChatLog(prev => [...prev, {
                                role: isAgent ? 'assistant' : 'user',
                                content: transcript,
                            }]);
                        }
                    }
                } catch {
                    // Not JSON
                }
            });

            // ── EVENT: Active speakers ──
            room.on(RoomEvent.ActiveSpeakersChanged, (speakers) => {
                const agentSpeaking = speakers.some(s =>
                    s.identity.includes('agent') || s.identity.includes('CA_')
                );
                setIsSpeaking(agentSpeaking);
            });

            // ── EVENT: Connection state ──
            room.on(RoomEvent.ConnectionStateChanged, (state: ConnectionState) => {
                console.log('[Sofia] Connection state:', state);
                if (state === ConnectionState.Connected) {
                    setIsConnected(true);
                    setIsConnecting(false);
                    setAgentStatus('Connected — waiting for Sofia...');
                    sessionStartRef.current = Date.now();

                    countdownRef.current = setInterval(() => {
                        const elapsed = Math.ceil((Date.now() - sessionStartRef.current) / 1000);
                        const remaining = Math.max(0, DAILY_LIMIT_SECONDS - getUsedSeconds() - elapsed);
                        setRemainingSeconds(remaining);
                        if (remaining <= 0) disconnect();
                    }, 1000);
                } else if (state === ConnectionState.Disconnected) {
                    setIsConnected(false);
                    setAgentStatus('Disconnected');
                }
            });

            room.on(RoomEvent.Disconnected, (reason?: DisconnectReason) => {
                console.log('[Sofia] Disconnected, reason:', reason);
                setIsConnected(false);
                setIsConnecting(false);
                setAgentStatus('Session ended');
            });

            // 3. Connect
            await room.connect(url, token);
            console.log('[Sofia] Connected to room:', room.name);

            // 4. Enable microphone — this publishes user audio to the room
            await room.localParticipant.setMicrophoneEnabled(true);
            console.log('[Sofia] Microphone enabled and publishing');

            // Check if mic is actually publishing
            const micPub = room.localParticipant.getTrackPublication(Track.Source.Microphone);
            console.log('[Sofia] Mic publication:', micPub ? 'active' : 'NOT FOUND');

        } catch (err) {
            console.error('[Sofia] Connection error:', err);
            setAgentStatus(`Error: ${err instanceof Error ? err.message : 'Connection failed'}`);
            setIsConnecting(false);
        }
    }, [isConnected, isConnecting, dailyLimitReached, customerName, user?.phone]);

    /* ── Disconnect ── */
    const disconnect = useCallback(() => {
        if (sessionStartRef.current > 0) {
            const elapsed = Math.ceil((Date.now() - sessionStartRef.current) / 1000);
            addUsedSeconds(elapsed);
            sessionStartRef.current = 0;
        }

        if (countdownRef.current) {
            clearInterval(countdownRef.current);
            countdownRef.current = null;
        }

        // Email transcript
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
            }).catch(err => console.warn('[Sofia] Email send failed:', err));
        }

        // Detach all audio elements
        if (audioContainerRef.current) {
            audioContainerRef.current.innerHTML = '';
        }

        if (roomRef.current) {
            roomRef.current.disconnect();
            roomRef.current = null;
        }

        setIsConnected(false);
        setIsConnecting(false);
        setIsOpen(false);
        setChatLog([]);
        setIsMuted(false);
        setIsSpeaking(false);
        setAgentStatus('');
    }, [chatLog]);

    /* ── Toggle mic ── */
    const toggleMute = useCallback(async () => {
        const room = roomRef.current;
        if (!room) return;
        const newMuted = !isMuted;
        await room.localParticipant.setMicrophoneEnabled(!newMuted);
        setIsMuted(newMuted);
        console.log('[Sofia] Mic', newMuted ? 'muted' : 'unmuted');
    }, [isMuted]);

    /* ── Toggle panel ── */
    const toggle = useCallback(() => {
        if (!isOpen) {
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

    /* ── Cleanup ── */
    useEffect(() => {
        return () => {
            if (roomRef.current) roomRef.current.disconnect();
            if (countdownRef.current) clearInterval(countdownRef.current);
        };
    }, []);

    if (!isAuthenticated) return null;

    return (
        <>
            {/* Hidden container for agent audio elements */}
            <div ref={audioContainerRef} style={{ display: 'none' }} />

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
                    {/* Header */}
                    <div className="flex items-center justify-between px-4 py-3 bg-indigo-600 text-white rounded-t-2xl">
                        <div className="flex items-center gap-2">
                            <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-400' : isConnecting ? 'bg-yellow-400 animate-pulse' : 'bg-gray-400'}`} />
                            <span className="font-semibold text-sm">Sofia · Voice Assistant</span>
                            {isConnecting && <Loader2 className="w-4 h-4 animate-spin" />}
                            {isSpeaking && <span className="text-xs bg-green-500 rounded-full px-2 py-0.5">🔊 Speaking</span>}
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

                    {/* Start screen */}
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
                                <p className="text-sm text-red-500 text-center">Daily limit reached. Try again tomorrow.</p>
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
                            <div className="relative">
                                <div className="w-16 h-16 rounded-full border-4 border-indigo-200 border-t-indigo-600 animate-spin" />
                            </div>
                            <p className="text-sm text-gray-500 dark:text-gray-400">{agentStatus}</p>
                        </div>
                    )}

                    {/* Status bar */}
                    {isConnected && (
                        <div className="px-4 py-2 bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
                            <div className="flex items-center justify-between">
                                <span className="text-xs text-green-600 font-medium">{agentStatus}</span>
                                {isMuted && <span className="text-xs text-red-500 font-medium">🔇 Muted</span>}
                            </div>
                        </div>
                    )}

                    {/* Chat log */}
                    {isConnected && (
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
