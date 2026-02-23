'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
    LiveKitRoom,
    RoomAudioRenderer,
    useVoiceAssistant,
    BarVisualizer,
    useConnectionState,
    useLocalParticipant,
    useDataChannel,
} from '@livekit/components-react';
import '@livekit/components-styles';
import { ConnectionState } from 'livekit-client';
import { Mic, MicOff, PhoneOff, UserRoundPlus, X, MessageCircle, ChevronDown } from 'lucide-react';
import {
    bookingVoiceController,
    VOICE_EVENTS,
    WIZARD_EVENTS,
    fuzzyMatch,
} from '@/lib/booking-voice-controller';

/* ─────────────────────────────────────────────
   Inner: runs inside <LiveKitRoom> context
   Handles data channel messages from the AI agent
   ───────────────────────────────────────────── */
function VoiceSession({ onDisconnect, onTransfer }: { onDisconnect: () => void; onTransfer: () => void }) {
    const { agent, audioTrack, state } = useVoiceAssistant();
    const connectionState = useConnectionState();
    const [isMuted, setIsMuted] = useState(false);
    const { localParticipant } = useLocalParticipant();
    const currentOptionsRef = useRef<{ id: string; name: string }[]>([]);
    const currentStepRef = useRef(0);

    // Data channel: receive commands from the AI agent
    const onDataReceived = useCallback((msg: any) => {
        try {
            const payload = typeof msg.payload === 'string' ? msg.payload : new TextDecoder().decode(msg.payload);
            const data = JSON.parse(payload);
            console.log('[VoiceAgent] Data received:', data);

            if (data.action) {
                const options = currentOptionsRef.current;
                switch (data.action) {
                    case 'selectClinic':
                        if (data.name) {
                            const match = fuzzyMatch(data.name, options);
                            if (match) bookingVoiceController.emit(VOICE_EVENTS.SELECT_CLINIC, { id: match.id, name: match.name });
                        }
                        break;
                    case 'selectDept':
                        if (data.name) {
                            const match = fuzzyMatch(data.name, options);
                            if (match) bookingVoiceController.emit(VOICE_EVENTS.SELECT_DEPT, { id: match.id, name: match.name });
                        }
                        break;
                    case 'selectService':
                        if (data.name) {
                            const match = fuzzyMatch(data.name, options);
                            if (match) bookingVoiceController.emit(VOICE_EVENTS.SELECT_SERVICE, { id: match.id, name: match.name });
                        }
                        break;
                    case 'selectDoctor':
                        if (data.name) {
                            const match = fuzzyMatch(data.name, options);
                            if (match) bookingVoiceController.emit(VOICE_EVENTS.SELECT_DOCTOR, { id: match.id, name: match.name });
                        }
                        break;
                    case 'selectDate':
                        bookingVoiceController.emit(VOICE_EVENTS.SELECT_DATE, { date: data.date });
                        break;
                    case 'selectSlot':
                        bookingVoiceController.emit(VOICE_EVENTS.SELECT_SLOT, { time: data.time });
                        break;
                    case 'confirm':
                        bookingVoiceController.emit(VOICE_EVENTS.CONFIRM, {});
                        break;
                    case 'goBack':
                        bookingVoiceController.emit(VOICE_EVENTS.GO_BACK, {});
                        break;
                    case 'transfer':
                        onTransfer();
                        break;
                }
            }
        } catch {
            // Non-JSON messages or parse errors are silently ignored
        }
    }, [onTransfer]);

    useDataChannel('booking-commands', onDataReceived);

    // Listen for wizard context updates (options for the current step)
    useEffect(() => {
        const unsubOptions = bookingVoiceController.on(WIZARD_EVENTS.OPTIONS, (data: { step: number; items: { id: string; name: string }[] }) => {
            currentOptionsRef.current = data.items;
            currentStepRef.current = data.step;
        });
        const unsubStep = bookingVoiceController.on(WIZARD_EVENTS.STEP_CHANGED, (data: { step: number }) => {
            currentStepRef.current = data.step;
        });
        return () => { unsubOptions(); unsubStep(); };
    }, []);

    const toggleMute = useCallback(async () => {
        if (localParticipant) {
            await localParticipant.setMicrophoneEnabled(isMuted);
            setIsMuted(!isMuted);
        }
    }, [localParticipant, isMuted]);

    const stateLabel = state === 'speaking' ? 'Speaking...' : state === 'listening' ? 'Listening...' : state === 'thinking' ? 'Thinking...' : 'Connected';
    const stateDot = state === 'speaking' ? 'bg-green-400' : state === 'listening' ? 'bg-blue-400' : state === 'thinking' ? 'bg-yellow-400' : 'bg-gray-400';

    return (
        <div className="flex flex-col h-full">
            {/* Status bar */}
            <div className="flex items-center gap-2 px-4 py-2 bg-gray-800/60">
                <div className={`w-2 h-2 rounded-full animate-pulse ${stateDot}`} />
                <span className="text-xs text-white/80 font-medium capitalize">{stateLabel}</span>
                {agent && <span className="ml-auto text-[10px] text-gray-500 uppercase tracking-wider">AI Assistant</span>}
            </div>

            {/* Visualizer area */}
            <div className="flex-1 flex items-center justify-center px-4">
                {audioTrack ? (
                    <div className="flex flex-col items-center gap-3">
                        <div className="w-24 h-24 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-full flex items-center justify-center shadow-xl shadow-indigo-500/30">
                            <BarVisualizer trackRef={audioTrack} className="w-16 h-16" barCount={5} />
                        </div>
                        <p className="text-sm text-white/70">{stateLabel}</p>
                    </div>
                ) : (
                    <div className="flex flex-col items-center gap-3">
                        <div className="w-20 h-20 bg-indigo-600/40 rounded-full flex items-center justify-center animate-pulse">
                            <Mic className="w-8 h-8 text-white/60" />
                        </div>
                        <p className="text-xs text-gray-400">
                            {connectionState === ConnectionState.Connecting ? 'Connecting...' : 'Waiting for assistant...'}
                        </p>
                    </div>
                )}
            </div>

            {/* Controls */}
            <div className="flex items-center justify-center gap-3 px-4 py-3 bg-gray-800/40">
                <button onClick={toggleMute} title={isMuted ? 'Unmute' : 'Mute'}
                    className={`p-2.5 rounded-full transition-all ${isMuted ? 'bg-red-500 hover:bg-red-600' : 'bg-gray-700 hover:bg-gray-600'}`}>
                    {isMuted ? <MicOff className="w-4 h-4 text-white" /> : <Mic className="w-4 h-4 text-white" />}
                </button>

                <button onClick={onTransfer} title="Transfer to Human"
                    className="p-2.5 rounded-full bg-amber-600 hover:bg-amber-700 transition-all">
                    <UserRoundPlus className="w-4 h-4 text-white" />
                </button>

                <button onClick={onDisconnect} title="End Call"
                    className="p-2.5 rounded-full bg-red-600 hover:bg-red-700 transition-all">
                    <PhoneOff className="w-4 h-4 text-white" />
                </button>
            </div>

            <RoomAudioRenderer />
        </div>
    );
}

/* ─────────────────────────────────────────────
   Main: floating bubble + expandable panel
   AUTO-STARTS session when mounted on booking page
   ───────────────────────────────────────────── */
export default function VoiceAgentBubble() {
    const [isOpen, setIsOpen] = useState(true);         // Auto-open
    const [isSessionActive, setIsSessionActive] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [connectionDetails, setConnectionDetails] = useState<{ token: string; url: string } | null>(null);
    const [transferStatus, setTransferStatus] = useState<'idle' | 'sending' | 'sent'>('idle');
    const [isMinimized, setIsMinimized] = useState(false);
    const autoStarted = useRef(false);

    /* Auto-start session on mount */
    const startSession = useCallback(async () => {
        if (isLoading || isSessionActive) return;
        setIsLoading(true);
        try {
            const res = await fetch('/api/livekit/token', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ context: 'booking-assistant' }),
            });
            if (!res.ok) throw new Error('Failed to get token');
            const data = await res.json();
            setConnectionDetails({ token: data.token, url: data.url });
            setIsSessionActive(true);
        } catch (err) {
            console.error('[VoiceAgent] Error:', err);
        } finally {
            setIsLoading(false);
        }
    }, [isLoading, isSessionActive]);

    // Auto-start on mount
    useEffect(() => {
        if (!autoStarted.current) {
            autoStarted.current = true;
            // Small delay to let the page render first
            const timer = setTimeout(() => startSession(), 1500);
            return () => clearTimeout(timer);
        }
    }, [startSession]);

    const endSession = useCallback(() => {
        setIsSessionActive(false);
        setConnectionDetails(null);
        setTransferStatus('idle');
    }, []);

    /* Request transfer to human representative */
    const handleTransfer = useCallback(async () => {
        setTransferStatus('sending');
        try {
            const res = await fetch('/api/voice-agent/transfer', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    sessionId: 'session-' + Date.now(),
                    timestamp: new Date().toISOString(),
                    source: 'booking-page',
                }),
            });
            if (res.ok) {
                setTransferStatus('sent');
            } else {
                setTransferStatus('idle');
            }
        } catch {
            setTransferStatus('idle');
        }
    }, []);

    const toggle = () => {
        if (isMinimized) {
            setIsMinimized(false);
            setIsOpen(true);
        } else {
            setIsMinimized(true);
            setIsOpen(false);
        }
    };

    return (
        <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-3">
            {/* ── Expanded panel ── */}
            {isOpen && !isMinimized && (
                <div className="w-80 h-[420px] bg-gray-900 rounded-2xl shadow-2xl shadow-black/40 border border-gray-700/50 overflow-hidden flex flex-col">
                    {/* Header */}
                    <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-indigo-600 to-purple-600">
                        <div className="flex items-center gap-2">
                            <MessageCircle className="w-4 h-4 text-white" />
                            <span className="text-sm font-semibold text-white">Booking Assistant</span>
                        </div>
                        <div className="flex items-center gap-1">
                            <button onClick={() => { setIsMinimized(true); setIsOpen(false); }} className="p-1 rounded-full hover:bg-white/20 transition-colors" title="Minimize">
                                <ChevronDown className="w-4 h-4 text-white" />
                            </button>
                            <button onClick={() => { setIsOpen(false); setIsMinimized(true); }} className="p-1 rounded-full hover:bg-white/20 transition-colors" title="Close">
                                <X className="w-4 h-4 text-white" />
                            </button>
                        </div>
                    </div>

                    {/* Body */}
                    <div className="flex-1 flex flex-col">
                        {isSessionActive && connectionDetails ? (
                            <>
                                {/* Transfer status banner */}
                                {transferStatus === 'sent' && (
                                    <div className="px-4 py-2 bg-green-600/20 border-b border-green-500/30">
                                        <p className="text-xs text-green-300 text-center">✓ Transfer requested — a representative will join shortly</p>
                                    </div>
                                )}
                                {transferStatus === 'sending' && (
                                    <div className="px-4 py-2 bg-amber-600/20 border-b border-amber-500/30">
                                        <p className="text-xs text-amber-300 text-center animate-pulse">Requesting human representative...</p>
                                    </div>
                                )}
                                <div className="flex-1">
                                    <LiveKitRoom
                                        token={connectionDetails.token}
                                        serverUrl={connectionDetails.url}
                                        connect={true}
                                        audio={true}
                                        video={false}
                                        onDisconnected={endSession}
                                        className="w-full h-full"
                                    >
                                        <VoiceSession onDisconnect={endSession} onTransfer={handleTransfer} />
                                    </LiveKitRoom>
                                </div>
                            </>
                        ) : (
                            /* Loading state */
                            <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
                                <div className="w-20 h-20 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-full flex items-center justify-center mb-4 shadow-xl shadow-indigo-500/25 animate-pulse">
                                    <Mic className="w-8 h-8 text-white" />
                                </div>
                                <h3 className="text-lg font-semibold text-white mb-1">
                                    {isLoading ? 'Connecting...' : 'Voice Assistant'}
                                </h3>
                                <p className="text-sm text-gray-400 mb-6 leading-relaxed">
                                    {isLoading
                                        ? 'Setting up your voice booking assistant...'
                                        : 'Your AI assistant will help you complete your booking by voice.'
                                    }
                                </p>
                                {!isLoading && (
                                    <button
                                        onClick={startSession}
                                        className="w-full py-3 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-medium rounded-xl transition-all shadow-lg shadow-indigo-500/25"
                                    >
                                        Start Voice Chat
                                    </button>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* ── Floating round button ── */}
            <button
                onClick={toggle}
                className={`group w-14 h-14 rounded-full shadow-xl transition-all duration-300 flex items-center justify-center
                    ${isOpen && !isMinimized
                        ? 'bg-gray-700 hover:bg-gray-600 shadow-gray-900/40'
                        : 'bg-gradient-to-br from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 shadow-indigo-500/40 hover:shadow-indigo-500/60 hover:scale-110'
                    }
                    ${isSessionActive && isMinimized ? 'ring-4 ring-green-400/50 ring-offset-2 ring-offset-gray-900' : ''}
                `}
                title="Voice Assistant"
            >
                {isOpen && !isMinimized ? (
                    <ChevronDown className="w-6 h-6 text-white" />
                ) : (
                    <>
                        <Mic className="w-6 h-6 text-white group-hover:scale-110 transition-transform" />
                        {isSessionActive && (
                            <span className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 bg-green-400 rounded-full border-2 border-gray-900 animate-pulse" />
                        )}
                    </>
                )}
            </button>
        </div>
    );
}
