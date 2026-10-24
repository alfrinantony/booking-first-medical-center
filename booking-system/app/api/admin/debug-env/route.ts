export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { SettingsStore } from '@/lib/settings-store';
import crypto from 'crypto';

export async function GET() {
    const settings = await SettingsStore.getSettings();
    const appSecret = settings.metaAppSecret || process.env.META_APP_SECRET || '91cec59e71b9a9c95636a491e71c6762';
    const messengerToken = settings.messengerAccessToken || process.env.META_PAGE_ACCESS_TOKEN || '';
    const waToken = settings.whatsappAccessToken || process.env.META_WA_ACCESS_TOKEN || messengerToken;

    function getProof(token: string) {
        if (!appSecret || !token) return '';
        return crypto.createHmac('sha256', appSecret).update(token).digest('hex');
    }

    const results: Record<string, any> = {
        settings: {
            metaAppId: settings.metaAppId,
            metaPageId: settings.metaPageId,
            metaIgUserId: settings.metaIgUserId,
            metaPhoneId: settings.metaPhoneId,
            metaWabaId: settings.metaWabaId,
            hasMessengerToken: Boolean(messengerToken),
            messengerTokenStart: messengerToken?.slice(0, 15),
            messengerTokenEnd: messengerToken?.slice(-10),
            hasWaToken: Boolean(waToken),
            waTokenStart: waToken?.slice(0, 15),
            waTokenEnd: waToken?.slice(-10),
        },
        diagnostics: {}
    };

    // 1. Check /me with messengerToken
    if (messengerToken) {
        try {
            const p = getProof(messengerToken);
            const res = await fetch(`https://graph.facebook.com/v21.0/me?access_token=${messengerToken}&appsecret_proof=${p}`);
            results.diagnostics.meMessenger = await res.json();
        } catch (e: any) {
            results.diagnostics.meMessengerError = e.message;
        }

        // 2. Check /me/accounts with messengerToken
        try {
            const p = getProof(messengerToken);
            const res = await fetch(`https://graph.facebook.com/v21.0/me/accounts?fields=id,name,access_token,instagram_business_account&access_token=${messengerToken}&appsecret_proof=${p}`);
            const data = await res.json();
            if (data.data) {
                results.diagnostics.pages = data.data.map((pg: any) => ({
                    id: pg.id,
                    name: pg.name,
                    hasToken: Boolean(pg.access_token),
                    pageTokenStart: pg.access_token?.slice(0, 15),
                    pageTokenEnd: pg.access_token?.slice(-10),
                    instagram_business_account: pg.instagram_business_account
                }));
            } else {
                results.diagnostics.pages = data;
            }
        } catch (e: any) {
            results.diagnostics.pagesError = e.message;
        }

        // 3. Check pageId directly
        if (settings.metaPageId) {
            try {
                const p = getProof(messengerToken);
                const res = await fetch(`https://graph.facebook.com/v21.0/${settings.metaPageId}?fields=id,name,access_token&access_token=${messengerToken}&appsecret_proof=${p}`);
                const data = await res.json();
                results.diagnostics.pageDirect = {
                    id: data.id,
                    name: data.name,
                    hasToken: Boolean(data.access_token),
                    pageTokenStart: data.access_token?.slice(0, 15),
                    pageTokenEnd: data.access_token?.slice(-10),
                    error: data.error
                };
            } catch (e: any) {
                results.diagnostics.pageDirectError = e.message;
            }
        }

        // 4. Check igUserId directly
        if (settings.metaIgUserId) {
            try {
                const p = getProof(messengerToken);
                const res = await fetch(`https://graph.facebook.com/v21.0/${settings.metaIgUserId}?fields=id,username,name&access_token=${messengerToken}&appsecret_proof=${p}`);
                results.diagnostics.igDirect = await res.json();
            } catch (e: any) {
                results.diagnostics.igDirectError = e.message;
            }
        }
    }

    // 5. Check WABA phone numbers with waToken
    if (waToken && (settings.metaWabaId || settings.metaPhoneId)) {
        const wabaId = settings.metaWabaId || '518094511384485';
        try {
            const p = getProof(waToken);
            const res = await fetch(`https://graph.facebook.com/v21.0/${wabaId}/phone_numbers?access_token=${waToken}&appsecret_proof=${p}`);
            results.diagnostics.wabaPhoneNumbers = await res.json();
        } catch (e: any) {
            results.diagnostics.wabaPhoneNumbersError = e.message;
        }

        if (settings.metaPhoneId) {
            try {
                const p = getProof(waToken);
                const res = await fetch(`https://graph.facebook.com/v21.0/${settings.metaPhoneId}?fields=id,display_phone_number,verified_name,code_verification_status,quality_rating&access_token=${waToken}&appsecret_proof=${p}`);
                results.diagnostics.metaPhoneDirect = await res.json();
            } catch (e: any) {
                results.diagnostics.metaPhoneDirectError = e.message;
            }
        }

        // Also test with '2177289126457948'
        try {
            const p = getProof(waToken);
            const res = await fetch(`https://graph.facebook.com/v21.0/2177289126457948?fields=id,display_phone_number,verified_name&access_token=${waToken}&appsecret_proof=${p}`);
            results.diagnostics.hardcodedPhoneDirect = await res.json();
        } catch (e: any) {
            results.diagnostics.hardcodedPhoneDirectError = e.message;
        }
    }

    return NextResponse.json(results);
}

