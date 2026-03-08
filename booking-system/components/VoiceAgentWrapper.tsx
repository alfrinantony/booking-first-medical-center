'use client';

import dynamic from 'next/dynamic';

const CallCenterAgent = dynamic(() => import('@/components/CallCenterAgent'), { ssr: false });

export default function VoiceAgentWrapper() {
    return <CallCenterAgent />;
}
