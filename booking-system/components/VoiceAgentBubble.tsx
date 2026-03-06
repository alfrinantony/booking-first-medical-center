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
    const [selectedLanguage, setSelectedLanguage] = useState<'en' | 'ar' | null>(null);

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
    const connect = useCallback(async (lang: 'en' | 'ar') => {
        if (isConnected || isConnecting || dailyLimitReached) return;

        setSelectedLanguage(lang);
        setIsConnecting(true);
        setAgentStatus('Connecting to Sofia...');
        console.log('[Sofia] Starting connection, language:', lang);

        try {
            // 1. Get token — pass language in metadata
            const tokenRes = await fetch('/api/livekit-token', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    customerName,
                    customerPhone: user?.phone || '',
                    language: lang,
                }),
            });

            if (!tokenRes.ok) {
                const err = await tokenRes.json();
                throw new Error(err.error || 'Failed to get token');
            }

            const { token, url } = await tokenRes.json();
            console.log('[Sofia] Token received, connecting to:', url);

            // 2. Request microphone FIRST (before room connection)
            //    This ensures we have mic permission from user gesture context
            let micStream: MediaStream;
            try {
                micStream = await navigator.mediaDevices.getUserMedia({
                    audio: {
                        echoCancellation: true,
                        noiseSuppression: true,
                        autoGainControl: true,
                    },
                });
                console.log('[Sofia] Microphone access granted');
            } catch (micErr) {
                console.error('[Sofia] Mic access denied:', micErr);
                setAgentStatus('Microphone access denied. Please allow mic access.');
                setIsConnecting(false);
                return;
            }

            // 3. Create Room
            const room = new Room({
                adaptiveStream: true,
                dynacast: true,
                audioCaptureDefaults: {
                    autoGainControl: true,
                    echoCancellation: true,
                    noiseSuppression: true,
                },
                audioOutput: {
                    deviceId: 'default',
                },
            });

            roomRef.current = room;

            // ── EVENT: Agent audio track subscribed ──
            room.on(RoomEvent.TrackSubscribed, (track, publication: RemoteTrackPublication, participant: RemoteParticipant) => {
                console.log('[Sofia] Track subscribed:', track.kind, 'from:', participant.identity);

                if (track.kind === Track.Kind.Audio) {
                    // track.attach() creates a new <audio> element with the right srcObject
                    const audioEl = track.attach();
                    audioEl.autoplay = true;
                    audioEl.setAttribute('playsinline', 'true');
                    audioEl.volume = 1.0;
                    audioEl.muted = false;

                    // Append to hidden container
                    if (audioContainerRef.current) {
                        audioContainerRef.current.appendChild(audioEl);
                    } else {
                        document.body.appendChild(audioEl);
                    }

                    // Force play (needed for some browsers)
                    audioEl.play().then(() => {
                        console.log('[Sofia] ✅ Agent audio playing');
                    }).catch(err => {
                        console.warn('[Sofia] ⚠️ Audio autoplay blocked, trying workaround:', err);
                        // Try again on next user interaction
                        const resume = () => {
                            audioEl.play();
                            document.removeEventListener('click', resume);
                        };
                        document.addEventListener('click', resume);
                    });

                    setIsSpeaking(true);
                    setAgentStatus('Sofia is speaking...');
                }
            });

            // Track unsubscribed
            room.on(RoomEvent.TrackUnsubscribed, (track) => {
                track.detach().forEach(el => el.remove());
                if (track.kind === Track.Kind.Audio) {
                    setIsSpeaking(false);
                }
            });

            // ── EVENT: Agent joins ──
            room.on(RoomEvent.ParticipantConnected, (participant: RemoteParticipant) => {
                console.log('[Sofia] Agent joined:', participant.identity);
                setAgentStatus('Sofia is here — speak now');

                // Add initial greeting to chat log
                const langLabel = lang === 'ar' ? 'Arabic' : 'English';
                const greeting = lang === 'ar'
                    ? 'مرحباً! أنا صوفيا، مساعدتك في الحجز. كيف أقدر أساعدك؟'
                    : `Hello${customerName ? ` ${customerName.split(' ')[0]}` : ''}! I'm Sofia, your booking assistant. How may I help you?`;
                setChatLog(prev => {
                    if (prev.length === 0) return [{ role: 'assistant' as const, content: greeting }];
                    return prev;
                });
            });

            // ── EVENT: Data messages ──
            room.on(RoomEvent.DataReceived, (payload: Uint8Array, participant?: RemoteParticipant) => {
                try {
                    const text = new TextDecoder().decode(payload);
                    const data = JSON.parse(text);
                    console.log('[Sofia] Data:', data);

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

            // Active speakers
            room.on(RoomEvent.ActiveSpeakersChanged, (speakers) => {
                const agentSpeaking = speakers.some(s =>
                    s.identity !== room.localParticipant.identity
                );
                setIsSpeaking(agentSpeaking);
                if (agentSpeaking) setAgentStatus('Sofia is speaking...');
                else if (isConnected) setAgentStatus('Listening...');
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
                console.log('[Sofia] Disconnected:', reason);
                setIsConnected(false);
                setIsConnecting(false);
                setAgentStatus('Session ended');
            });

            // 4. Connect to the room
            await room.connect(url, token);
            console.log('[Sofia] ✅ Connected to room:', room.name);

            // 5. Stop the getUserMedia stream (room will create its own)
            micStream.getTracks().forEach(t => t.stop());

            // 6. Enable microphone through LiveKit
            await room.localParticipant.setMicrophoneEnabled(true);
            console.log('[Sofia] ✅ Microphone enabled');

            // Verify mic is publishing
            const micPub = room.localParticipant.getTrackPublication(Track.Source.Microphone);
            if (micPub) {
                console.log('[Sofia] ✅ Mic track is publishing, trackSid:', micPub.trackSid);
            } else {
                console.warn('[Sofia] ⚠️ Mic track NOT found after enabling');
            }

            // Log room participants
            console.log('[Sofia] Participants in room:', room.remoteParticipants.size);
            room.remoteParticipants.forEach((p, id) => {
                console.log('[Sofia] Remote participant:', id, p.identity);
            });

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

        // Clean up audio
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
        setSelectedLanguage(null);
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
            if (user) {
                const clientId = user.phone || user.email || user.name || '';
                if (useRestrictionsStore.getState().isVoiceBlocked(clientId)) {
                    alert('Voice booking is not available for your account.');
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
            {/* Hidden container for agent audio */}
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
                            {selectedLanguage && (
                                <span className="text-xs bg-indigo-700 rounded-full px-2 py-0.5">
                                    {selectedLanguage === 'ar' ? '🇦🇪 AR' : '🇬🇧 EN'}
                                </span>
                            )}
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

                    {/* ── LANGUAGE SELECTION ── */}
                    {!isConnected && !isConnecting && !selectedLanguage && (
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
                                        onClick={() => connect('en')}
                                        className="flex-1 flex flex-col items-center gap-2 p-5 rounded-xl border-2 border-gray-200 dark:border-gray-600 hover:border-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-all group"
                                    >
                                        <span className="text-3xl">🇬🇧</span>
                                        <span className="font-semibold text-gray-900 dark:text-white group-hover:text-indigo-600">English</span>
                                    </button>
                                    <button
                                        onClick={() => connect('ar')}
                                        className="flex-1 flex flex-col items-center gap-2 p-5 rounded-xl border-2 border-gray-200 dark:border-gray-600 hover:border-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-all group"
                                    >
                                        <span className="text-3xl">🇦🇪</span>
                                        <span className="font-semibold text-gray-900 dark:text-white group-hover:text-indigo-600">العربية</span>
                                    </button>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Connecting spinner */}
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
                                <span className="text-xs text-green-600 font-medium flex items-center gap-1">
                                    {isSpeaking && <span className="inline-block w-2 h-2 bg-green-500 rounded-full animate-pulse" />}
                                    {agentStatus}
                                </span>
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
