import { NextResponse } from 'next/server';
import { GoogleReviewsInboxStore } from '@/lib/google-reviews-inbox-store';

/**
 * POST /api/cron/auto-reply-reviews
 *
 * CRON endpoint: scans all unreplied reviews. If a review has been
 * unreplied for > 6 hours, generates a professional AI reply and posts it.
 *
 * Should be called periodically (e.g., every 30 minutes) by an external
 * CRON service or Azure Function timer trigger.
 *
 * Optional header: x-cron-secret to protect the endpoint.
 */

/** Generate a professional reply based on star rating */
function generateAutoReply(reviewerName: string, starRating: number, reviewText: string, clinicName: string): string {
    const firstName = reviewerName.split(' ')[0];

    if (starRating >= 4) {
        // Positive review (4-5 stars)
        const templates = [
            `Dear ${firstName}, thank you so much for your wonderful ${starRating}-star review! We're thrilled to hear about your positive experience at our ${clinicName}. Your kind words mean the world to our team. We look forward to welcoming you back! - First Medical Center`,
            `Thank you for your excellent review, ${firstName}! We're delighted that you had a great experience at ${clinicName}. Our team works hard to provide the best care, and your feedback motivates us to keep improving. See you soon! - First Medical Center`,
            `Dear ${firstName}, we truly appreciate your ${starRating}-star rating and kind words! The team at ${clinicName} is dedicated to delivering exceptional care, and it's wonderful to know we met your expectations. Thank you for choosing First Medical Center!`,
        ];
        return templates[Math.floor(Math.random() * templates.length)];
    } else if (starRating === 3) {
        // Neutral review (3 stars)
        return `Dear ${firstName}, thank you for taking the time to share your feedback about ${clinicName}. We appreciate your honest review and take your comments seriously. We'd love the opportunity to improve your next experience. Please don't hesitate to reach out to us directly so we can address your concerns. - First Medical Center`;
    } else {
        // Negative review (1-2 stars)
        return `Dear ${firstName}, we sincerely apologize for not meeting your expectations at ${clinicName}. Your feedback is extremely valuable to us, and we take it very seriously. We would like to make things right — please contact our patient relations team at your earliest convenience so we can address your concerns personally and ensure a better experience in the future. - First Medical Center`;
    }
}

export async function POST(request: Request) {
    try {
        // Optional: verify CRON secret
        const cronSecret = process.env.CRON_SECRET;
        if (cronSecret) {
            const providedSecret = request.headers.get('x-cron-secret');
            if (providedSecret !== cronSecret) {
                return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
            }
        }

        // Refresh reviews first to catch any new ones
        await GoogleReviewsInboxStore.refresh();

        // Get unreplied reviews older than 6 hours
        const unreplied = await GoogleReviewsInboxStore.getUnrepliedOlderThan(6);

        if (unreplied.length === 0) {
            return NextResponse.json({
                success: true,
                message: 'No reviews require auto-reply',
                processed: 0,
            });
        }

        let processed = 0;
        const errors: string[] = [];

        for (const review of unreplied) {
            try {
                // Generate professional reply
                const replyContent = generateAutoReply(
                    review.reviewerName,
                    review.starRating,
                    review.reviewText,
                    review.clinicName
                );

                // Save as auto-reply
                await GoogleReviewsInboxStore.addReply(review.id, replyContent, true);

                // TODO: If Google My Business API credentials are configured,
                // post the reply to Google here using the Business Profile API.

                processed++;
                console.log(`[AutoReply] Auto-replied to review ${review.id} by ${review.reviewerName}`);
            } catch (err) {
                const errMsg = `Failed to auto-reply to ${review.id}: ${err}`;
                console.error(`[AutoReply] ${errMsg}`);
                errors.push(errMsg);
            }
        }

        return NextResponse.json({
            success: true,
            message: `Auto-replied to ${processed} out of ${unreplied.length} reviews`,
            processed,
            total: unreplied.length,
            errors: errors.length > 0 ? errors : undefined,
        });
    } catch (error) {
        console.error('[AutoReply] CRON error:', error);
        return NextResponse.json(
            { error: 'Auto-reply CRON failed' },
            { status: 500 }
        );
    }
}
