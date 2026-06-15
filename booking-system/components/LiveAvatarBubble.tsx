'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
    LiveKitRoom,
    useVoiceAssistant,
    RoomAudioRenderer,
    VideoTrack,
} from '@livekit/components-react';
import { Mic, MicOff, PhoneOff, Timer, Smartphone } from 'lucide-react';

/* ─────────────────────────────────────────────
   Constants
   ───────────────────────────────────────────── */
const MAX_SESSION_SECONDS = 180; // 3 minutes
const STORAGE_KEY = 'fmc_avatar_usage';

/* ─────────────────────────────────────────────
   Daily usage tracking (localStorage)
   ───────────────────────────────────────────── */
function getDailyKey(): string {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function getUsedSeconds(): number {
    try {
        const data = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
        return data[getDailyKey()] || 0;
    } catch { return 0; }
}

function addUsedSeconds(seconds: number): void {
    try {
        const data = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
        data[getDailyKey()] = (data[getDailyKey()] || 0) + seconds;
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch { /* ignore */ }
}

/* ─────────────────────────────────────────────
   Mobile detection
   ───────────────────────────────────────────── */
function isMobileDevice(): boolean {
    if (typeof window === 'undefined') return false;
    const ua = navigator.userAgent || '';
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua) ||
        (window.innerWidth <= 768);
}

/* ─────────────────────────────────────────────
   Inner component (inside LiveKitRoom)
   ───────────────────────────────────────────── */
function AvatarSession({ onEnd, remainingSeconds: initialRemaining }: { onEnd: () => void; remainingSeconds: number }) {
    const { agent, audioTrack, videoTrack, state } = useVoiceAssistant();
    const [remaining, setRemaining] = useState(initialRemaining);
    const [isMuted, setIsMuted] = useState(false);
    const startTimeRef = useRef(Date.now());

    // Countdown timer
    useEffect(() => {
        const interval = setInterval(() => {
            const elapsed = Math.floor((Date.now() - startTimeRef.current) / 1000);
            const left = Math.max(0, initialRemaining - elapsed);
            setRemaining(left);

            if (left <= 0) {
                addUsedSeconds(initialRemaining);
                clearInterval(interval);
                onEnd();
            }
        }, 1000);

        return () => {
            const elapsed = Math.floor((Date.now() - startTimeRef.current) / 1000);
            addUsedSeconds(Math.min(elapsed, initialRemaining));
            clearInterval(interval);
        };
    }, [initialRemaining, onEnd]);

    const minutes = Math.floor(remaining / 60);
    const seconds = remaining % 60;
    const progress = remaining / MAX_SESSION_SECONDS;

    // Timer color based on remaining time
    const timerColor = remaining <= 30 ? '#ef4444' : remaining <= 60 ? '#f59e0b' : '#6366f1';

    return (
        <div className="flex flex-col items-center gap-4">
            {/* Circular Avatar Container */}
            <div className="relative">
                {/* Timer ring */}
                <svg className="absolute -inset-2 w-[calc(100%+16px)] h-[calc(100%+16px)]" viewBox="0 0 100 100">
                    <circle cx="50" cy="50" r="47" fill="none" stroke="#e5e7eb" strokeWidth="3" />
                    <circle
                        cx="50" cy="50" r="47"
                        fill="none"
                        stroke={timerColor}
                        strokeWidth="3"
                        strokeLinecap="round"
                        strokeDasharray={`${progress * 295.3} 295.3`}
                        transform="rotate(-90 50 50)"
                        className="transition-all duration-1000"
                    />
                </svg>

                {/* Avatar Video Circle */}
                <div className="w-48 h-48 sm:w-56 sm:h-56 rounded-full overflow-hidden bg-gradient-to-br from-indigo-900 to-purple-900 shadow-2xl shadow-indigo-500/30 border-4 border-white/20">
                    {videoTrack ? (
                        <VideoTrack
                            trackRef={videoTrack}
                            className="w-full h-full object-cover scale-[1.1]"
                        />
                    ) : (
                        <div className="w-full h-full flex items-center justify-center">
                            <div className="text-center">
                                <div className="w-16 h-16 mx-auto mb-2 rounded-full bg-white/10 flex items-center justify-center animate-pulse">
                                    <Mic className="w-8 h-8 text-white/60" />
                                </div>
                                <p className="text-white/60 text-xs">
                                    {state === 'connecting' ? 'Connecting...' :
                                        state === 'initializing' ? 'Initializing...' :
                                            'Waiting for avatar...'}
                                </p>
                            </div>
                        </div>
                    )}
                </div>

                {/* Status indicator */}
                <div className={`absolute bottom-1 right-1 w-5 h-5 rounded-full border-2 border-white ${(state as any) === 'connected' ? 'bg-green-500 animate-pulse' :
                    state === 'connecting' || state === 'initializing' ? 'bg-yellow-500 animate-pulse' :
                        'bg-gray-400'
                    }`} />
            </div>

            {/* Timer Display */}
            <div className="flex items-center gap-2 bg-gray-900/80 backdrop-blur-sm px-4 py-2 rounded-full">
                <Timer className="w-4 h-4" style={{ color: timerColor }} />
                <span className="font-mono text-lg font-bold text-white">
                    {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
                </span>
            </div>

            {/* Controls */}
            <div className="flex gap-3">
                <button
                    onClick={() => setIsMuted(!isMuted)}
                    className={`p-3 rounded-full transition-all ${isMuted
                        ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30'
                        : 'bg-white/10 text-white/80 hover:bg-white/20'
                        }`}
                    title={isMuted ? 'Unmute' : 'Mute'}
                >
                    {isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
                </button>
                <button
                    onClick={onEnd}
                    className="p-3 rounded-full bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-all"
                    title="End session"
                >
                    <PhoneOff className="w-5 h-5" />
                </button>
            </div>

            <RoomAudioRenderer />
        </div>
    );
}

/* ─────────────────────────────────────────────
   Main LiveAvatarBubble Component
   ───────────────────────────────────────────── */
export default function LiveAvatarBubble() {
    const [isMobile, setIsMobile] = useState(false);
    const [isMounted, setIsMounted] = useState(false);
    const [sessionState, setSessionState] = useState<'idle' | 'connecting' | 'active' | 'ended'>('idle');
    const [token, setToken] = useState<string | null>(null);
    const [livekitUrl, setLivekitUrl] = useState<string>('');
    const [geoBlocked, setGeoBlocked] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [remainingSeconds, setRemainingSeconds] = useState(MAX_SESSION_SECONDS);

    // Mount check + mobile detection
    useEffect(() => {
        setIsMounted(true);
        setIsMobile(isMobileDevice());

        const handleResize = () => setIsMobile(isMobileDevice());
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    // Calculate remaining seconds on mount
    useEffect(() => {
        if (isMounted) {
            const used = getUsedSeconds();
            setRemainingSeconds(Math.max(0, MAX_SESSION_SECONDS - used));
        }
    }, [isMounted]);

    const startSession = useCallback(async () => {
        // Check remaining time
        const used = getUsedSeconds();
        const remaining = Math.max(0, MAX_SESSION_SECONDS - used);
        if (remaining <= 0) {
            setSessionState('ended');
            return;
        }

        setSessionState('connecting');
        setError(null);

        try {
            const res = await fetch('/api/livekit-token', { method: 'POST' });

            if (res.status === 403) {
                setGeoBlocked(true);
                setSessionState('idle');
                return;
            }

            if (!res.ok) {
                throw new Error('Failed to get token');
            }

            const data = await res.json();
            setToken(data.token);
            setLivekitUrl(data.url);
            setRemainingSeconds(remaining);
            setSessionState('active');
        } catch (err) {
            console.error('[LiveAvatar] Error:', err);
            setError('Unable to start session. Please try again.');
            setSessionState('idle');
        }
    }, []);

    const endSession = useCallback(() => {
        setToken(null);
        setSessionState('ended');
        const used = getUsedSeconds();
        setRemainingSeconds(Math.max(0, MAX_SESSION_SECONDS - used));
    }, []);

    if (!isMounted) return null;

    // Geo-blocked
    if (geoBlocked) return null;

    // Session ended — no remaining time
    const timeLeft = MAX_SESSION_SECONDS - getUsedSeconds();
    const isExpired = timeLeft <= 0;

    /* ── Desktop View: Static avatar with "Mobile only" badge ── */
    if (!isMobile) {
        return (
            <div className="flex flex-col items-center gap-4">
                {/* Static Circular Avatar */}
                <div className="relative group">
                    <div className="w-48 h-48 sm:w-56 sm:h-56 rounded-full overflow-hidden bg-gradient-to-br from-indigo-600 to-purple-700 shadow-2xl shadow-indigo-500/20 border-4 border-white/30 flex items-center justify-center">
                        <div className="text-center p-4">
                            <div className="w-20 h-20 mx-auto mb-3 rounded-full bg-white/10 flex items-center justify-center">
                                <svg xmlns="http://www.w3.org/2000/svg" className="w-10 h-10 text-white/80" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M12 12c2.76 0 5-2.24 5-5s-2.24-5-5-5-5 2.24-5 5 2.24 5 5 5z" />
                                    <path d="M20 21c0-3.31-3.58-6-8-6s-8 2.69-8 6" />
                                </svg>
                            </div>
                            <p className="text-white/90 text-sm font-medium">AI Assistant</p>
                        </div>
                    </div>
                    {/* "Mobile only" badge */}
                    <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-xs font-medium px-3 py-1.5 rounded-full flex items-center gap-1.5 shadow-lg whitespace-nowrap">
                        <Smartphone className="w-3.5 h-3.5" />
                        Available on mobile
                    </div>
                </div>
                <p className="text-gray-500 dark:text-gray-400 text-sm text-center max-w-[200px]">
                    Scan QR or visit on your phone to chat with our AI assistant
                </p>
            </div>
        );
    }

    /* ── Mobile View: Interactive Avatar ── */
    return (
        <div className="flex flex-col items-center gap-4">
            {/* Active Session */}
            {sessionState === 'active' && token && livekitUrl && (
                <LiveKitRoom
                    token={token}
                    serverUrl={livekitUrl}
                    connect={true}
                    audio={true}
                    video={false}
                    onDisconnected={endSession}
                >
                    <AvatarSession onEnd={endSession} remainingSeconds={remainingSeconds} />
                </LiveKitRoom>
            )}

            {/* Idle State: Tap to start */}
            {sessionState === 'idle' && !isExpired && (
                <div className="flex flex-col items-center gap-4">
                    <button
                        onClick={startSession}
                        className="relative group"
                    >
                        {/* Pulsing ring */}
                        <div className="absolute inset-0 rounded-full bg-indigo-500/20 animate-ping" style={{ animationDuration: '2s' }} />
                        <div className="absolute -inset-2 rounded-full bg-gradient-to-r from-indigo-500/20 to-purple-500/20 animate-pulse" />

                        {/* Avatar circle */}
                        <div className="relative w-48 h-48 rounded-full overflow-hidden bg-gradient-to-br from-indigo-600 to-purple-700 shadow-2xl shadow-indigo-500/30 border-4 border-white/30 flex items-center justify-center group-hover:scale-105 transition-transform duration-300">
                            <div className="text-center">
                                <div className="w-16 h-16 mx-auto mb-2 rounded-full bg-white/10 flex items-center justify-center">
                                    <Mic className="w-8 h-8 text-white/80 group-hover:text-white transition-colors" />
                                </div>
                                <p className="text-white font-medium text-sm">Tap to Talk</p>
                                <p className="text-white/60 text-xs mt-1">AI Assistant</p>
                            </div>
                        </div>
                    </button>

                    {/* Remaining time info */}
                    <div className="flex items-center gap-1.5 text-gray-500 dark:text-gray-400 text-xs">
                        <Timer className="w-3.5 h-3.5" />
                        <span>{Math.floor(timeLeft / 60)}:{String(timeLeft % 60).padStart(2, '0')} remaining today</span>
                    </div>
                </div>
            )}

            {/* Connecting State */}
            {sessionState === 'connecting' && (
                <div className="flex flex-col items-center gap-4">
                    <div className="w-48 h-48 rounded-full bg-gradient-to-br from-indigo-600 to-purple-700 shadow-2xl shadow-indigo-500/30 border-4 border-white/30 flex items-center justify-center">
                        <div className="text-center">
                            <div className="w-12 h-12 mx-auto mb-3 border-3 border-white/30 border-t-white rounded-full animate-spin" />
                            <p className="text-white/80 text-sm">Connecting...</p>
                        </div>
                    </div>
                </div>
            )}

            {/* Ended State */}
            {(sessionState === 'ended' || isExpired) && sessionState !== 'active' && (
                <div className="flex flex-col items-center gap-4">
                    <div className="w-48 h-48 rounded-full bg-gradient-to-br from-gray-700 to-gray-800 shadow-xl border-4 border-white/10 flex items-center justify-center">
                        <div className="text-center p-4">
                            <div className="w-14 h-14 mx-auto mb-2 rounded-full bg-white/5 flex items-center justify-center">
                                <Timer className="w-7 h-7 text-gray-400" />
                            </div>
                            <p className="text-white/80 text-sm font-medium">Session Ended</p>
                            <p className="text-gray-400 text-xs mt-1">Resets tomorrow</p>
                        </div>
                    </div>
                    {sessionState === 'ended' && !isExpired && (
                        <button
                            onClick={() => { setSessionState('idle'); setError(null); }}
                            className="text-indigo-400 hover:text-indigo-300 text-sm font-medium transition-colors"
                        >
                            Start new session
                        </button>
                    )}
                </div>
            )}

            {/* Error */}
            {error && (
                <p className="text-red-400 text-xs text-center">{error}</p>
            )}
        </div>
    );
}
