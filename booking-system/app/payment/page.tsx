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

    const [clientSecret, setClientSecret] = useState("");

    const [paymentMethod, setPaymentMethod] = useState<'card' | 'tabby' | 'tamara' | 'clinic'>('card');
    const [isProcessing, setIsProcessing] = useState(false);

    // Calculate totals
    const surchargeMetric = 0.05; // 5%
    const isSurchargeApplicable = paymentMethod === 'tabby' || paymentMethod === 'tamara';
    const surchargeAmount = isSurchargeApplicable ? amount * surchargeMetric : 0;
    const totalAmount = amount + surchargeAmount;

    useEffect(() => {
        if (paymentMethod === 'card' && amount > 0) {
            // Create PaymentIntent as soon as the page loads
            fetch("/api/payment/intent", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ amount }),
            })
                .then((res) => res.json())
                .then((data) => setClientSecret(data.clientSecret));
        } else {
            setClientSecret(""); // Reset client secret if not card
        }
    }, [amount, paymentMethod]);

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
                        {isSurchargeApplicable && (
                            <div className="flex justify-between text-sm text-indigo-600 dark:text-indigo-400">
                                <span>Service Fee (5%):</span>
                                <span>+{surchargeAmount.toFixed(2)} AED</span>
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
                        onClick={() => setPaymentMethod('tabby')}
                        className={`p-3 border rounded-lg flex flex-col items-center justify-center gap-2 transition-all relative overflow-hidden ${paymentMethod === 'tabby'
                            ? 'border-green-500 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 ring-2 ring-green-500 ring-offset-2 dark:ring-offset-gray-900'
                            : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                            }`}
                    >
                        <div className="font-bold text-sm">tabby</div>
                        <span className="text-xs text-center text-gray-500">Split in 4</span>
                        <div className="absolute top-0 right-0 bg-yellow-400 text-[10px] font-bold px-1.5 py-0.5 rounded-bl">+5%</div>
                    </button>

                    <button
                        onClick={() => setPaymentMethod('tamara')}
                        className={`p-3 border rounded-lg flex flex-col items-center justify-center gap-2 transition-all relative overflow-hidden ${paymentMethod === 'tamara'
                            ? 'border-orange-500 bg-orange-50 dark:bg-orange-900/20 text-orange-700 dark:text-orange-300 ring-2 ring-orange-500 ring-offset-2 dark:ring-offset-gray-900'
                            : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                            }`}
                    >
                        <div className="font-bold text-sm">tamara</div>
                        <span className="text-xs text-center text-gray-500">Split in 3</span>
                        <div className="absolute top-0 right-0 bg-yellow-400 text-[10px] font-bold px-1.5 py-0.5 rounded-bl">+5%</div>
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
                {paymentMethod === 'card' && clientSecret && (
                    <Elements options={options} stripe={stripePromise}>
                        <CheckoutForm amount={amount} serviceName={serviceName} bookingDate={bookingDate} slot={slot} doctorName={doctorName} clinicName={clinicName} />
                    </Elements>
                )}

                {(paymentMethod === 'tabby' || paymentMethod === 'tamara') && (
                    <div className="text-center">
                        <div className="bg-gray-100 dark:bg-gray-700 p-4 rounded-lg mb-6 text-sm">
                            You will be redirected to <strong>{paymentMethod === 'tabby' ? 'Tabby' : 'Tamara'}</strong> to complete your payment of <strong>{totalAmount.toFixed(2)} AED</strong> for <strong>{serviceName}</strong>.
                        </div>
                        <button
                            onClick={handleMockPayment}
                            disabled={isProcessing}
                            className="w-full bg-black text-white font-bold py-3 px-4 rounded-md hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                        >
                            {isProcessing ? (
                                <>
                                    <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full"></div>
                                    Redirecting...
                                </>
                            ) : (
                                `Pay with ${paymentMethod === 'tabby' ? 'Tabby' : 'Tamara'}`
                            )}
                        </button>
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
