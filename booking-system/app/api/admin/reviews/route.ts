import { NextRequest, NextResponse } from 'next/server';
import { ReviewsServerStore } from '@/lib/reviews-server-store';

/**
 * GET /api/admin/reviews
 *   ?customerPhone=... → returns reviews for that customer
 *   (no params) → returns all reviews
 */
export async function GET(request: NextRequest) {
    const phone = request.nextUrl.searchParams.get('customerPhone');
    if (phone) {
        return NextResponse.json(ReviewsServerStore.getByCustomer(phone));
    }
    return NextResponse.json(ReviewsServerStore.getAll());
}

/**
 * POST /api/admin/reviews
 * Body: { customerPhone, clinicId, rating } → submit/update a review
 *   OR: { sync: true, reviews: [...] }     → bulk sync from client
 */
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();

        // Bulk sync from client localStorage
        if (body.sync && Array.isArray(body.reviews)) {
            const merged = ReviewsServerStore.sync(body.reviews);
            return NextResponse.json(merged);
        }

        // Single review submission
        if (!body.customerPhone || !body.clinicId || !body.rating) {
            return NextResponse.json(
                { error: 'Missing required fields: customerPhone, clinicId, rating' },
                { status: 400 }
            );
        }

        const review = ReviewsServerStore.add({
            customerPhone: body.customerPhone,
            clinicId: body.clinicId,
            rating: Math.max(1, Math.min(5, Math.round(body.rating))),
        });

        return NextResponse.json(review, { status: 201 });
    } catch (error) {
        return NextResponse.json({ error: 'Failed to process review' }, { status: 500 });
    }
}

/**
 * DELETE /api/admin/reviews?id=...
 */
export async function DELETE(request: NextRequest) {
    const id = request.nextUrl.searchParams.get('id');
    if (!id) {
        return NextResponse.json({ error: 'Missing review id' }, { status: 400 });
    }
    ReviewsServerStore.delete(id);
    return NextResponse.json({ success: true });
}
