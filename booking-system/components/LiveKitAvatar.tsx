'use client';

import React, { useCallback, useEffect, useState } from 'react';
import {
    LiveKitRoom,
    RoomAudioRenderer,
    VideoTrack,
    useVoiceAssistant,
    BarVisualizer,
    useConnectionState,
    useLocalParticipant,
} from '@livekit/components-react';
import '@livekit/components-styles';
import { ConnectionState } from 'livekit-client';
import { Mic, MicOff, PhoneOff, Video } from 'lucide-react';

interface LiveKitAvatarProps {
    className?: string;
}

/**
 * Inner component that runs inside the LiveKitRoom context.
 * Uses the useVoiceAssistant hook to get agent audio/video tracks.
 */
function AgentSession({ onDisconnect }: { onDisconnect: () => void }) {
    const { agent, audioTrack, videoTrack, state } = useVoiceAssistant();
    const connectionState = useConnectionState();
    const [isMuted, setIsMuted] = useState(false);

    // Get local participant for microphone control
    const { localParticipant } = useLocalParticipant();

    const toggleMute = useCallback(async () => {
        if (localParticipant) {
            if (isMuted) {
                await localParticipant.setMicrophoneEnabled(true);
                setIsMuted(false);
            } else {
                await localParticipant.setMicrophoneEnabled(false);
                setIsMuted(true);
            }
        }
    }, [localParticipant, isMuted]);

    return (
        <div className="relative w-full h-full">
            {/* Avatar Video or Audio Visualizer */}
            <div className="absolute inset-0 flex items-center justify-center">
                {videoTrack ? (
                    <VideoTrack
                        trackRef={videoTrack}
                        className="w-full h-full object-cover"
                    />
                ) : audioTrack ? (
                    <div className="flex flex-col items-center gap-6">
                        <div className="w-40 h-40 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-full flex items-center justify-center shadow-2xl shadow-indigo-500/30">
                            <BarVisualizer
                                trackRef={audioTrack}
                                className="w-24 h-24"
                                barCount={5}
                            />
                        </div>
                        <div className="text-center">
                            <p className="text-white text-lg font-medium">
                                AI Medical Assistant
                            </p>
                            <p className="text-gray-400 text-sm mt-1">
                                {state === 'speaking'
                                    ? 'Speaking...'
                                    : state === 'listening'
                                        ? 'Listening...'
                                        : state === 'thinking'
                                            ? 'Thinking...'
                                            : 'Connected'}
                            </p>
                        </div>
                    </div>
                ) : (
                    <div className="flex flex-col items-center gap-4">
                        <div className="w-24 h-24 bg-indigo-600/50 rounded-full flex items-center justify-center animate-pulse">
                            <Video className="w-10 h-10 text-white/70" />
                        </div>
                        <p className="text-gray-400 text-sm">
                            {connectionState === ConnectionState.Connecting
                                ? 'Connecting to room...'
                                : 'Waiting for AI assistant...'}
                        </p>
                    </div>
                )}
            </div>

            {/* Agent State Indicator */}
            {agent && (
                <div className="absolute top-4 left-4 flex items-center gap-2 bg-gray-800/80 backdrop-blur-sm px-3 py-1.5 rounded-full">
                    <div
                        className={`w-2 h-2 rounded-full ${state === 'speaking'
                            ? 'bg-green-400 animate-pulse'
                            : state === 'listening'
                                ? 'bg-blue-400 animate-pulse'
                                : state === 'thinking'
                                    ? 'bg-yellow-400 animate-pulse'
                                    : 'bg-gray-400'
                            }`}
                    />
                    <span className="text-white text-xs font-medium capitalize">
                        {state || 'idle'}
                    </span>
                </div>
            )}

            {/* Controls */}
            <div className="absolute bottom-6 left-1/2 transform -translate-x-1/2 flex items-center gap-4 bg-gray-800/80 backdrop-blur-sm p-3 rounded-full z-10">
                <button
                    onClick={toggleMute}
                    className={`p-3 rounded-full transition-all duration-200 ${isMuted
                        ? 'bg-red-500 hover:bg-red-600 shadow-lg shadow-red-500/30'
                        : 'bg-gray-700 hover:bg-gray-600'
                        }`}
                    title={isMuted ? 'Unmute' : 'Mute'}
                >
                    {isMuted ? (
                        <MicOff className="w-5 h-5 text-white" />
                    ) : (
                        <Mic className="w-5 h-5 text-white" />
                    )}
                </button>

                <button
                    onClick={onDisconnect}
                    className="p-3 rounded-full bg-red-600 hover:bg-red-700 transition-all duration-200 shadow-lg shadow-red-600/30"
                    title="End Call"
                >
                    <PhoneOff className="w-5 h-5 text-white" />
                </button>
            </div>

            {/* Audio renderer — plays agent audio through speakers */}
            <RoomAudioRenderer />
        </div>
    );
}

/**
 * LiveKit Avatar Interface Component
 *
 * Connects to a LiveKit room and renders the AI agent's video/audio.
 * Replaces the old HeyGen/LiveAvatar SDK approach with WebRTC via LiveKit.
 */
export default function LiveKitAvatar({ className }: LiveKitAvatarProps) {
    const [isSessionActive, setIsSessionActive] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [connectionDetails, setConnectionDetails] = useState<{
        token: string;
        url: string;
    } | null>(null);

    const startSession = useCallback(async () => {
        setIsLoading(true);
        setError(null);

        try {
            // Get a token from our server
            const response = await fetch('/api/livekit/token', {
                method: 'POST',
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(
                    errorData.error || 'Failed to get connection token'
                );
            }

            const data = await response.json();

            setConnectionDetails({
                token: data.token,
                url: data.url,
            });
            setIsSessionActive(true);
        } catch (err: any) {
            console.error('[LiveKitAvatar] Error starting session:', err);
            setError(err.message || 'Failed to start session');
        } finally {
            setIsLoading(false);
        }
    }, []);

    const endSession = useCallback(() => {
        setIsSessionActive(false);
        setConnectionDetails(null);
        setError(null);
    }, []);

    return (
        <div
            className={`relative w-full h-full bg-gray-900 rounded-xl overflow-hidden shadow-2xl ${className}`}
        >
            {isSessionActive && connectionDetails ? (
                <LiveKitRoom
                    token={connectionDetails.token}
                    serverUrl={connectionDetails.url}
                    connect={true}
                    audio={true}
                    video={false}
                    onDisconnected={endSession}
                    className="w-full h-full"
                >
                    <AgentSession onDisconnect={endSession} />
                </LiveKitRoom>
            ) : (
                <div className="absolute inset-0 flex items-center justify-center">
                    <div className="text-center p-6">
                        <div className="w-24 h-24 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-full flex items-center justify-center mx-auto mb-4 animate-pulse shadow-2xl shadow-indigo-500/30">
                            <Video className="w-10 h-10 text-white" />
                        </div>
                        <h3 className="text-xl font-semibold text-white mb-2">
                            Start Consultation
                        </h3>
                        <p className="text-gray-400 mb-6">
                            Connect with our AI medical assistant via WebRTC
                        </p>

                        {error && (
                            <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 mb-4">
                                <p className="text-red-400 text-sm">{error}</p>
                            </div>
                        )}

                        <button
                            onClick={startSession}
                            disabled={isLoading}
                            className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-medium py-3 px-8 rounded-full transition-all transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-indigo-500/30"
                        >
                            {isLoading ? (
                                <span className="flex items-center gap-2">
                                    <svg
                                        className="animate-spin h-4 w-4"
                                        viewBox="0 0 24 24"
                                    >
                                        <circle
                                            className="opacity-25"
                                            cx="12"
                                            cy="12"
                                            r="10"
                                            stroke="currentColor"
                                            strokeWidth="4"
                                            fill="none"
                                        />
                                        <path
                                            className="opacity-75"
                                            fill="currentColor"
                                            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                                        />
                                    </svg>
                                    Connecting...
                                </span>
                            ) : (
                                'Start Session'
                            )}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
