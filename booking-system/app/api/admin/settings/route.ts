import { NextRequest, NextResponse } from 'next/server';
import { SettingsStore } from '@/lib/settings-store';

export async function GET() {
    const settings = await SettingsStore.getSettings();
    return NextResponse.json(settings);
}

export async function POST(req: NextRequest) {
    const updates = await req.json();
    await SettingsStore.updateSettings(updates);
    return NextResponse.json({ success: true });
}
