export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { clinics } from '@/lib/data';

/**
 * GET /api/admin/google-reviews?customerName=...
 *
 * Fetches real Google reviews for each clinic branch via the Places API (New),
 * then fuzzy-matches reviewer display names against the given customerName.
 * Returns matched reviews so the dashboard can auto-populate ratings.
 *
 * Response shape:
 *   { matches: [{ clinicId, rating, reviewerName, reviewText, relativeTime }] }
 */

// ── In-memory cache to avoid hammering the API ──
interface CachedReviews {
    reviews: PlaceReview[];
    fetchedAt: number;
}
interface PlaceReview {
    clinicId: string;
    authorName: string;
    rating: number;
    text: string;
    relativeTime: string;
}
const cache = new Map<string, CachedReviews>();
const CACHE_TTL = 10 * 60 * 1000; // 10 minutes

// ── Place ID cache (CID/name → placeId) ──
const placeIdCache = new Map<string, string>();

async function lookupPlaceId(clinic: typeof clinics[0], apiKey: string): Promise<string | null> {
    // Check cache first
    if (placeIdCache.has(clinic.id)) return placeIdCache.get(clinic.id)!;

    // Use Text Search (New) to find the place
    const query = `First Medical Center ${clinic.name} Dubai`;
    try {
        const res = await fetch(
            'https://places.googleapis.com/v1/places:searchText',
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Goog-Api-Key': apiKey,
                    'X-Goog-FieldMask': 'places.id,places.displayName',
                },
                body: JSON.stringify({ textQuery: query }),
            }
        );
        if (!res.ok) return null;
        const data = await res.json();
        const placeId = data?.places?.[0]?.id;
        if (placeId) {
            placeIdCache.set(clinic.id, placeId);
            return placeId;
        }
    } catch {
        // silent
    }
    return null;
}

async function fetchReviewsForClinic(
    clinic: typeof clinics[0],
    apiKey: string
): Promise<PlaceReview[]> {
    // Check cache
    const cached = cache.get(clinic.id);
    if (cached && Date.now() - cached.fetchedAt < CACHE_TTL) {
        return cached.reviews;
    }

    const placeId = await lookupPlaceId(clinic, apiKey);
    if (!placeId) return [];

    try {
        const res = await fetch(
            `https://places.googleapis.com/v1/places/${placeId}`,
            {
                headers: {
                    'X-Goog-Api-Key': apiKey,
                    'X-Goog-FieldMask': 'reviews',
                },
            }
        );
        if (!res.ok) return [];
        const data = await res.json();
        const reviews: PlaceReview[] = (data?.reviews || []).map((r: any) => ({
            clinicId: clinic.id,
            authorName: r.authorAttribution?.displayName || '',
            rating: r.rating || 0,
            text: r.text?.text || '',
            relativeTime: r.relativePublishTimeDescription || '',
        }));

        cache.set(clinic.id, { reviews, fetchedAt: Date.now() });
        return reviews;
    } catch {
        return [];
    }
}

/**
 * Fuzzy name comparison: returns true if names share enough similarity.
 * Handles case differences, partial names, and name order.
 */
function namesMatch(googleName: string, customerName: string): boolean {
    const g = googleName.toLowerCase().trim();
    const c = customerName.toLowerCase().trim();

    // Exact match
    if (g === c) return true;

    // One contains the other
    if (g.includes(c) || c.includes(g)) return true;

    // Word-level matching: at least 2 words match (for "John Smith" vs "Smith John")
    const gWords = g.split(/\s+/).filter(w => w.length > 1);
    const cWords = c.split(/\s+/).filter(w => w.length > 1);
    const commonWords = gWords.filter(w => cWords.includes(w));
    if (commonWords.length >= 2) return true;

    // First + last name match (handle abbreviated first name like "J. Smith" → "John Smith")
    if (gWords.length >= 1 && cWords.length >= 1) {
        const gLast = gWords[gWords.length - 1];
        const cLast = cWords[cWords.length - 1];
        if (gLast === cLast && gWords[0][0] === cWords[0][0]) return true;
    }

    return false;
}

export async function GET(request: NextRequest) {
    const customerName = request.nextUrl.searchParams.get('customerName');
    if (!customerName) {
        return NextResponse.json({ error: 'customerName is required' }, { status: 400 });
    }

    // Get API key from settings store (server-side: read from env or default)
    const apiKey = process.env.GOOGLE_MAPS_API_KEY || process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || '';
    if (!apiKey) {
        return NextResponse.json({ matches: [], message: 'No Google API key configured' });
    }

    // Fetch reviews for all clinics in parallel
    const allReviews = await Promise.all(
        clinics.map(clinic => fetchReviewsForClinic(clinic, apiKey))
    );
    const flatReviews = allReviews.flat();

    // Find matches
    const matches = flatReviews
        .filter(r => namesMatch(r.authorName, customerName))
        .map(r => ({
            clinicId: r.clinicId,
            rating: r.rating,
            reviewerName: r.authorName,
            reviewText: r.text,
            relativeTime: r.relativeTime,
        }));

    return NextResponse.json({ matches });
}
