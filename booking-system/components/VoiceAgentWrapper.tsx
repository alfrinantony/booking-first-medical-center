'use client';

import dynamic from 'next/dynamic';

const VoiceAgentBubble = dynamic(() => import('@/components/VoiceAgentBubble'), { ssr: false });

export default function VoiceAgentWrapper() {
    return <VoiceAgentBubble />;
}
