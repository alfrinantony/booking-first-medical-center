import BookingWizard from "@/components/BookingWizard";
import VoiceAgentWrapper from "@/components/VoiceAgentWrapper";

export default function BookingPage() {
    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-12 px-4 sm:px-6 lg:px-8">
            <div className="max-w-7xl mx-auto">
                <div className="text-center mb-12">
                    <h1 className="text-4xl font-extrabold text-gray-900 dark:text-white sm:text-5xl sm:tracking-tight lg:text-6xl">
                        Book Your Appointment
                    </h1>
                    <p className="mt-5 max-w-xl mx-auto text-xl text-gray-500 dark:text-gray-400">
                        Select your preferred clinic, service, and specialist with our easy booking process.
                    </p>
                </div>
                <BookingWizard />
            </div>
            <VoiceAgentWrapper />
        </div>
    );
}
