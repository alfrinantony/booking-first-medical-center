export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import Stripe from 'stripe';

// Lazy-init Stripe so the build doesn't crash when the env var is missing
let _stripe: Stripe | null = null;
function getStripe() {
    if (!_stripe) {
        _stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { typescript: true });
    }
    return _stripe;
}

export async function POST(req: Request) {
    try {
        const { amount, currency = 'usd' } = await req.json();

        if (!amount) {
            return NextResponse.json(
                { error: 'Amount is required' },
                { status: 400 }
            );
        }

        // Create a PaymentIntent with the order amount and currency
        const paymentIntent = await getStripe().paymentIntents.create({
            amount: Math.round(amount * 100), // Stripe expects amount in cents
            currency: currency,
            automatic_payment_methods: {
                enabled: true,
            },
        });

        return NextResponse.json({
            clientSecret: paymentIntent.client_secret,
        });
    } catch (error: any) {
        console.error('Stripe API Error:', error);
        return NextResponse.json(
            { error: error.message },
            { status: 500 }
        );
    }
}
