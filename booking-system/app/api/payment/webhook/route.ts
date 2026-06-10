import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { BookingsStore } from '@/lib/bookings-store';
import { BillingStore } from '@/lib/billing-store';

let _stripe: Stripe | null = null;
function getStripe() {
    if (!_stripe) {
        _stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { typescript: true });
    }
    return _stripe;
}

export async function POST(req: Request) {
    const body = await req.text();
    const signature = req.headers.get('stripe-signature') as string;

    let event: Stripe.Event;

    try {
        if (process.env.STRIPE_WEBHOOK_SECRET) {
            event = getStripe().webhooks.constructEvent(body, signature, process.env.STRIPE_WEBHOOK_SECRET);
        } else {
            // Development fallback without signature verification
            event = JSON.parse(body) as Stripe.Event;
        }
    } catch (err: any) {
        console.error(`Webhook Error: ${err.message}`);
        return NextResponse.json({ error: `Webhook Error: ${err.message}` }, { status: 400 });
    }

    if (event.type === 'payment_intent.succeeded') {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        const bookingId = paymentIntent.metadata?.bookingId;

        if (bookingId) {
            try {
                const booking = await BookingsStore.getById(bookingId);
                if (booking) {
                    // 1. Update Booking status
                    await BookingsStore.update(bookingId, {
                        sbPaymentStatus: 'paid',
                        status: 'confirmed'
                    } as any);

                    // 2. Generate Invoice
                    await BillingStore.createInvoice({
                        invoiceCategory: 'consultation',
                        clientName: booking.patientName,
                        clientPhone: booking.whatsappNumber || booking.patientName, // Fallback
                        items: [{
                            description: `Consultation: ${booking.serviceName || 'Service'}`,
                            quantity: 1,
                            unitPrice: paymentIntent.amount / 100,
                            total: paymentIntent.amount / 100,
                        }],
                        subtotal: paymentIntent.amount / 100,
                        taxPercentage: 0,
                        taxAmount: 0,
                        totalAmount: paymentIntent.amount / 100,
                        paymentMethod: 'online',
                        paymentConfirmed: true,
                        paymentReceptionStatus: 'received',
                        generatedBy: 'System (Online Booking)',
                        date: new Date().toISOString().split('T')[0],
                        notes: `Online Payment via Stripe. Booking ID: ${bookingId}. Stripe Reference: ${paymentIntent.id}`
                    });

                    console.log(`Successfully processed payment for booking ${bookingId}`);
                } else {
                    console.warn(`Webhook received payment for unknown bookingId: ${bookingId}`);
                }
            } catch (e) {
                console.error("Error processing booking payment:", e);
                return NextResponse.json({ error: "Internal Server Error updating booking" }, { status: 500 });
            }
        }
    }

    return NextResponse.json({ received: true });
}
