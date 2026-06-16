'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import { Elements } from '@stripe/react-stripe-js';
import CheckoutForm from '@/components/CheckoutForm';
import { useSearchParams, useRouter } from 'next/navigation';

// Make sure to call loadStripe outside of a component’s render to avoid
// recreating the Stripe object on every render.
const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!);

function PaymentContent() {
    const searchParams = useSearchParams();
    const router = useRouter();

    const amountParam = searchParams.get('amount');
    const amount = amountParam ? parseFloat(amountParam) : 0;
    const serviceName = searchParams.get('serviceName') || 'Service';
    const bookingDate = searchParams.get('bookingDate') || '';
    const slot = searchParams.get('slot') || '';
    const doctorName = searchParams.get('doctorName') || '';
    const clinicName = searchParams.get('clinicName') || '';
    const bookingId = searchParams.get('bookingId') || '';

    const [clientSecret, setClientSecret] = useState("");
    const [stripeError, setStripeError] = useState("");
    const [isLoadingStripe, setIsLoadingStripe] = useState(false);

    const [paymentMethod, setPaymentMethod] = useState<'card' | 'clinic'>('card');
    const [isProcessing, setIsProcessing] = useState(false);

    // Promo Code State
    const [currentAmount, setCurrentAmount] = useState(amount);
    const [promoCodeInput, setPromoCodeInput] = useState('');
    const [appliedPromo, setAppliedPromo] = useState<any>(null);
    const [promoError, setPromoError] = useState<string | null>(null);
    const [isValidatingPromo, setIsValidatingPromo] = useState(false);

    // Calculate totals
    const totalAmount = currentAmount;

    useEffect(() => {
        if (paymentMethod === 'card' && currentAmount > 0) {
            setIsLoadingStripe(true);
            setStripeError("");
            // Create PaymentIntent as soon as the page loads (or when amount changes via promo)
            fetch("/api/payment/intent", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ amount: currentAmount, bookingId }),
            })
                .then((res) => {
                    if (!res.ok) throw new Error("Could not initialize Stripe payment");
                    return res.json();
                })
                .then((data) => {
                    if (data.clientSecret) {
                         setClientSecret(data.clientSecret);
                    } else if (data.error) {
                         setStripeError(data.error);
                    }
                })
                .catch((err) => setStripeError(err.message))
                .finally(() => setIsLoadingStripe(false));
            
        } else {
            setClientSecret(""); // Reset client secret if not card
        }
    }, [currentAmount, paymentMethod]);

    const handleApplyPromo = async () => {
        if (!promoCodeInput) return;
        setIsValidatingPromo(true);
        setPromoError(null);

        try {
            const res = await fetch('/api/admin/promos');
            if (res.ok) {
                const promos = await res.json();
                const promo = promos.find((p: any) => p.code === promoCodeInput && p.active);

                if (!promo) {
                    setPromoError('Invalid or inactive promo code.');
                    setAppliedPromo(null);
                    setCurrentAmount(amount); // Revert to original amount
                    return;
                }

                // Calculate discount
                let discount = 0;
                if (promo.discountType === 'percentage') {
                    discount = amount * (promo.discountValue / 100);
                } else {
                    discount = promo.discountValue;
                }

                const newAmount = Math.max(0, amount - discount);
                
                // Patch the booking in the database to reflect the new amount
                if (bookingId) {
                    await fetch(`/api/bookings/${bookingId}`, {
                        method: 'PATCH',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ amount: newAmount })
                    });
                }

                setAppliedPromo(promo);
                setCurrentAmount(newAmount);
                setPromoCodeInput(''); // clear input on success
            } else {
                setPromoError('Failed to validate code.');
            }
        } catch (err) {
            setPromoError('Error validating code.');
        } finally {
            setIsValidatingPromo(false);
        }
    };

    const handleMockPayment = async () => {
        setIsProcessing(true);
        // Simulate API call/Redirection
        await new Promise(resolve => setTimeout(resolve, 1500));
        const extraParams = `&bookingDate=${encodeURIComponent(bookingDate)}&slot=${encodeURIComponent(slot)}&doctorName=${encodeURIComponent(doctorName)}&clinicName=${encodeURIComponent(clinicName)}`;
        router.push(`/booking/success?method=${paymentMethod}&amount=${totalAmount}&serviceName=${encodeURIComponent(serviceName)}${extraParams}`);
    };

    const appearance = {
        theme: 'stripe' as const,
    };
    const options = {
        clientSecret,
        appearance,
    };

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
            <div className="max-w-md w-full space-y-8 bg-white dark:bg-gray-800 p-8 rounded-xl shadow-lg">
                <div>
                    <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900 dark:text-white">
                        Secure Payment
                    </h2>
                    <p className="mt-2 text-center text-sm text-gray-500 dark:text-gray-400">
                        for <strong className="text-gray-900 dark:text-white">{serviceName}</strong>
                    </p>
                    <div className="mt-4 bg-gray-50 dark:bg-gray-700/50 p-4 rounded-lg space-y-2">
                        <div className="flex justify-between text-sm text-gray-600 dark:text-gray-400">
                            <span>{serviceName}:</span>
                            <span>{amount.toFixed(2)} AED</span>
                        </div>

                        {appliedPromo && (
                            <div className="flex justify-between text-sm text-green-600">
                                <span>Promo Discount ({appliedPromo.code}):</span>
                                <span>-{(amount - currentAmount).toFixed(2)} AED</span>
                            </div>
                        )}

                        <div className="flex justify-between text-lg font-bold text-gray-900 dark:text-white pt-2 border-t border-gray-200 dark:border-gray-700">
                            <span>Total to Pay:</span>
                            <span>{totalAmount.toFixed(2)} AED</span>
                        </div>
                    </div>
                </div>

                {/* Payment Method Grid */}
                <div className="grid grid-cols-2 gap-3 mb-6">
                    <button
                        onClick={() => setPaymentMethod('card')}
                        className={`p-3 border rounded-lg flex flex-col items-center justify-center gap-2 transition-all ${paymentMethod === 'card'
                            ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-300 ring-2 ring-indigo-500 ring-offset-2 dark:ring-offset-gray-900'
                            : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                            }`}
                    >
                        <span className="font-bold text-sm">Credit Card</span>
                        <span className="text-xs text-center text-gray-500">Stripe Secure</span>
                    </button>

                    <button
                        onClick={() => setPaymentMethod('clinic')}
                        className={`p-3 border rounded-lg flex flex-col items-center justify-center gap-2 transition-all ${paymentMethod === 'clinic'
                            ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 ring-2 ring-blue-500 ring-offset-2 dark:ring-offset-gray-900'
                            : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                            }`}
                    >
                        <span className="font-bold text-sm">Pay at Clinic</span>
                        <span className="text-xs text-center text-gray-500">Cash / Card</span>
                    </button>
                </div>

                {/* Render Payment UI based on selection */}
                {paymentMethod === 'card' && (
                    <div className="mt-4">
                        {isLoadingStripe ? (
                            <div className="flex flex-col items-center justify-center p-8 space-y-4">
                                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
                                <p className="text-sm text-gray-500">Initializing secure payment...</p>
                            </div>
                        ) : stripeError ? (
                            <div className="bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-200 p-4 rounded-lg text-sm text-center">
                                <p className="mb-2 font-bold">Payment Gateway Error</p>
                                <p className="mb-4">{stripeError}</p>
                                <button
                                    onClick={() => setPaymentMethod('clinic')}
                                    className="w-full bg-red-600 text-white font-bold py-2 px-4 rounded-md hover:bg-red-700 transition-colors"
                                >
                                    Pay at Clinic Instead
                                </button>
                            </div>
                        ) : clientSecret ? (
                            <div className="space-y-6">
                                {/* Promo Code Section */}
                                <div className="bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Have a Promo Code?</label>
                                    <div className="flex gap-2">
                                        <input
                                            type="text"
                                            placeholder="Enter code"
                                            value={promoCodeInput}
                                            onChange={(e) => setPromoCodeInput(e.target.value.toUpperCase())}
                                            disabled={isValidatingPromo}
                                            className="flex-1 p-2 border border-gray-300 rounded-lg dark:bg-gray-900 dark:border-gray-700 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm transition-shadow"
                                        />
                                        <button 
                                            onClick={handleApplyPromo}
                                            disabled={isValidatingPromo || !promoCodeInput}
                                            className="px-4 py-2 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 dark:bg-indigo-900/30 dark:text-indigo-300 dark:hover:bg-indigo-900/50 rounded-lg font-medium text-sm transition-colors disabled:opacity-50"
                                        >
                                            {isValidatingPromo ? 'Applying...' : 'Apply'}
                                        </button>
                                    </div>
                                    {promoError && <p className="text-red-500 text-xs mt-2">{promoError}</p>}
                                    {appliedPromo && <p className="text-green-500 text-xs mt-2 font-medium">Promo code applied successfully!</p>}
                                </div>

                                <Elements options={options} stripe={stripePromise}>
                                    <CheckoutForm amount={currentAmount} serviceName={serviceName} bookingDate={bookingDate} slot={slot} doctorName={doctorName} clinicName={clinicName} />
                                </Elements>
                            </div>
                        ) : null}
                    </div>
                )}


                {paymentMethod === 'clinic' && (
                    <div className="text-center">
                        <div className="bg-yellow-50 dark:bg-yellow-900/20 text-yellow-800 dark:text-yellow-200 p-4 rounded-lg mb-6 text-sm">
                            <p className="mb-2">You can pay <strong>{amount.toFixed(2)} AED</strong> for <strong>{serviceName}</strong> when you arrive at the clinic. Please arrive 15 minutes early.</p>
                            <p className="font-bold text-red-600 dark:text-red-400">Note: You must pay the full amount at the reception before starting the service.</p>
                        </div>
                        <button
                            onClick={handleMockPayment}
                            disabled={isProcessing}
                            className="w-full bg-indigo-600 text-white font-bold py-3 px-4 rounded-md hover:bg-indigo-700 transition-colors disabled:opacity-50"
                        >
                            {isProcessing ? 'Processing...' : 'Confirm Booking'}
                        </button>
                    </div>
                )}

            </div>
        </div>
    );
}

export default function PaymentPage() {
    return (
        <Suspense fallback={<div className="min-h-screen flex items-center justify-center">Loading payment...</div>}>
            <PaymentContent />
        </Suspense>
    );
}
