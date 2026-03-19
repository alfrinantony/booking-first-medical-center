export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { CallAgentSummaryStore } from '@/lib/call-agent-summary-store';

/**
 * External API endpoint for AI call agents to submit call summaries.
 * Protected by x-api-key header.
 *
 * Usage:
 *   POST /api/call-agent-summaries
 *   Headers: { "Content-Type": "application/json", "x-api-key": "<CALL_AGENT_API_KEY>" }
 *   Body: { customerId, customerName, customerNumber, summary, ... }
 */

const API_KEY = process.env.CALL_AGENT_API_KEY;

function validateApiKey(request: Request): boolean {
    const key = request.headers.get('x-api-key');
    if (!API_KEY || !key) return false;
    return key === API_KEY;
}

export async function POST(request: Request) {
    if (!validateApiKey(request)) {
        return NextResponse.json(
            { error: 'Unauthorized. Provide a valid x-api-key header.' },
            { status: 401 }
        );
    }

    try {
        const body = await request.json();
        const { customerId, customerName, customerNumber, summary } = body;

        if (!customerId || !customerName || !customerNumber || !summary) {
            return NextResponse.json(
                { error: 'Required fields: customerId, customerName, customerNumber, summary' },
                { status: 400 }
            );
        }

        const record = await CallAgentSummaryStore.add({
            ...body,
            callDuration: Number(body.callDuration) || 0,
            timestamp: body.timestamp || new Date().toISOString(),
        });

        return NextResponse.json(record, { status: 201 });
    } catch {
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

export async function GET(request: Request) {
    if (!validateApiKey(request)) {
        return NextResponse.json(
            { error: 'Unauthorized. Provide a valid x-api-key header.' },
            { status: 401 }
        );
    }

    const { searchParams } = new URL(request.url);
    const customerId = searchParams.get('customerId');

    let summaries = await CallAgentSummaryStore.getAll();

    if (customerId) {
        summaries = summaries.filter(s => s.customerId === customerId);
    }

    return NextResponse.json(summaries);
}
