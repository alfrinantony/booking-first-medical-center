import Link from "next/link";
import LiveAvatarBubble from "@/components/LiveAvatarBubble";
import { 
  MapPin, 
  Clock, 
  Phone, 
  Star, 
  Shield, 
  Sparkles, 
  Calendar, 
  ChevronRight, 
  MessageCircle, 
  PhoneCall 
} from "lucide-react";

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 via-white to-gray-50 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950 relative">

      {/* ── Fixed Floating Contact Widget ── */}
      <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-3">
        <a 
          href="https://wa.me/97142506262" 
          target="_blank" 
          rel="noopener noreferrer"
          className="flex items-center justify-center w-14 h-14 bg-green-500 text-white rounded-full shadow-lg hover:bg-green-600 hover:scale-110 transition-all cursor-pointer group"
          title="Chat on WhatsApp"
        >
          <MessageCircle className="w-6 h-6" />
          <span className="absolute right-16 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 text-sm font-bold px-3 py-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity shadow-md pointer-events-none whitespace-nowrap">
            WhatsApp Us
          </span>
        </a>
        <a 
          href="tel:+97142506262"
          className="flex items-center justify-center w-14 h-14 bg-indigo-600 text-white rounded-full shadow-lg hover:bg-indigo-700 hover:scale-110 transition-all cursor-pointer group"
          title="Call Us Directly"
        >
          <PhoneCall className="w-6 h-6" />
          <span className="absolute right-16 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 text-sm font-bold px-3 py-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity shadow-md pointer-events-none whitespace-nowrap">
            Call Clinic
          </span>
        </a>
      </div>

      {/* ── Hero Section ── */}
      <section className="relative overflow-hidden pt-20 pb-16 sm:pt-28 sm:pb-24">
        {/* Background decoration */}
        <div className="absolute inset-0 -z-10">
          <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-gradient-radial from-indigo-200/30 to-transparent dark:from-indigo-900/20 rounded-full blur-3xl translate-x-1/3 -translate-y-1/4" />
          <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-gradient-radial from-purple-200/20 to-transparent dark:from-purple-900/15 rounded-full blur-3xl -translate-x-1/3 translate-y-1/4" />
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col lg:flex-row items-center gap-12 lg:gap-16">

            {/* Left: Text Content */}
            <div className="flex-1 text-center lg:text-left">
              <div className="inline-flex items-center gap-2 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-300 px-4 py-1.5 rounded-full text-sm font-medium mb-6">
                <Sparkles className="w-4 h-4" />
                AI-Powered Aesthetic Clinic
              </div>

              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-gray-900 dark:text-white leading-tight tracking-tight">
                Your Beauty,{" "}
                <span className="bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
                  Our Expertise
                </span>
              </h1>

              <p className="mt-6 text-lg sm:text-xl text-gray-600 dark:text-gray-400 max-w-xl mx-auto lg:mx-0 leading-relaxed">
                Premium laser, dermatology and aesthetic treatments across 3 branches in Dubai.
                Book instantly with our AI assistant.
              </p>

              <div className="mt-8 flex flex-wrap gap-4 justify-center lg:justify-start">
                <Link
                  href="/booking"
                  className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-2xl shadow-lg shadow-indigo-500/25 transition-all hover:scale-[1.02] hover:shadow-xl hover:shadow-indigo-500/30"
                >
                  <Calendar className="w-5 h-5" />
                  Book Appointment
                </Link>
                <a
                  href="https://wa.me/97142506262"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-green-50 dark:bg-transparent text-green-700 dark:text-green-400 font-semibold rounded-2xl border border-green-200 dark:border-green-800 hover:bg-green-100 dark:hover:bg-green-900/30 transition-all hover:shadow-md"
                >
                  <MessageCircle className="w-5 h-5" />
                  WhatsApp
                </a>
              </div>

              {/* Trust badges */}
              <div className="mt-10 flex flex-wrap gap-6 justify-center lg:justify-start text-sm text-gray-500 dark:text-gray-400">
                <div className="flex items-center gap-1.5">
                  <Star className="w-4 h-4 fill-yellow-500 text-yellow-500" />
                  <span><strong className="text-gray-900 dark:text-white">4.8+</strong> Rating</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Shield className="w-4 h-4 text-green-500" />
                  <span>DHA Licensed</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <MapPin className="w-4 h-4 text-indigo-500" />
                  <span>3 Branches</span>
                </div>
              </div>
            </div>

            {/* Right: LiveAvatar Circle */}
            <div className="flex-shrink-0">
              <LiveAvatarBubble />
            </div>
          </div>
        </div>
      </section>

      {/* ── Branches Section ── */}
      <section className="py-16 sm:py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-white">
              Visit Us
            </h2>
            <p className="mt-4 text-gray-600 dark:text-gray-400">
              Three convenient locations across Dubai
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              {
                name: "Al Muraqabat Branch",
                address: "7th Floor, Dominos Pizza Building, Al Muraqabat St, Deira",
                phone: "+971 4 250 6262",
                hours: "Mon–Sat: 10 AM – 10 PM",
                rating: 4.8,
                reviews: 2336,
                image: "/images/branches/muraqabat.png",
              },
              {
                name: "Al Qiyadah Branch",
                address: "Mamzar Center, Opposite to Qiyadah Metro, Abu Hail",
                phone: "+971 4 261 7171",
                hours: "Mon–Sat: 10 AM – 10 PM",
                rating: 4.9,
                reviews: 1936,
                image: "/images/branches/qiyadah.png",
              },
              {
                name: "Silicon Oasis Branch",
                address: "15th Floor, SIT Tower, Silicon Oasis",
                phone: "+971 4 392 0809",
                hours: "Mon–Sat: 10 AM – 10 PM",
                rating: 4.8,
                reviews: 178,
                image: "/images/branches/silicon_oasis.png",
              },
            ].map((branch) => (
              <div
                key={branch.name}
                className="group bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 overflow-hidden hover:shadow-xl hover:border-indigo-300 dark:hover:border-indigo-600 transition-all duration-300"
              >
                <div className="relative h-40 overflow-hidden">
                  <img
                    src={branch.image}
                    alt={branch.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />
                  <div className="absolute bottom-3 left-4">
                    <h3 className="text-white font-bold drop-shadow-lg">{branch.name}</h3>
                  </div>
                  <div className="absolute top-3 right-3 flex items-center gap-1 bg-white/90 dark:bg-gray-900/90 text-xs font-bold px-2 py-1 rounded-lg">
                    {branch.rating} <Star className="w-3 h-3 fill-yellow-500 text-yellow-500" />
                    <span className="text-gray-400 font-normal">({branch.reviews})</span>
                  </div>
                </div>
                <div className="p-5 space-y-2.5 text-sm">
                  <div className="flex items-start gap-2 text-gray-600 dark:text-gray-300">
                    <MapPin className="w-4 h-4 mt-0.5 flex-shrink-0 text-indigo-500" />
                    <span>{branch.address}</span>
                  </div>
                  <div className="flex items-center gap-2 text-gray-600 dark:text-gray-300">
                    <Phone className="w-4 h-4 flex-shrink-0 text-indigo-500" />
                    <span>{branch.phone}</span>
                  </div>
                  <div className="flex items-center gap-2 text-gray-600 dark:text-gray-300">
                    <Clock className="w-4 h-4 flex-shrink-0 text-indigo-500" />
                    <span>{branch.hours}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA Section ── */}
      <section className="py-16 sm:py-20 bg-gradient-to-r from-indigo-600 to-purple-700">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
            Ready to Start Your Journey?
          </h2>
          <p className="text-indigo-100 text-lg mb-8 max-w-2xl mx-auto">
            Book your consultation today and discover the best treatments for you.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <Link
              href="/booking"
              className="inline-flex items-center gap-2 px-10 py-4 bg-white text-indigo-700 font-bold rounded-2xl shadow-xl hover:shadow-2xl transition-all hover:scale-[1.02]"
            >
              <Calendar className="w-5 h-5" />
              Book Now
            </Link>
            <a
              href="tel:+97142506262"
              className="inline-flex items-center gap-2 px-10 py-4 bg-transparent border-2 border-white text-white font-bold rounded-2xl hover:bg-white/10 transition-all hover:scale-[1.02]"
            >
              <PhoneCall className="w-5 h-5" />
              Call Us
            </a>
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="py-10 bg-gray-900 text-gray-400">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <div>
              <p className="text-white font-bold text-lg">First Medical Center LLC</p>
              <p className="text-sm mt-1">Premium Aesthetic & Laser Clinic — Dubai, UAE</p>
            </div>
            <div className="text-sm text-center md:text-right">
              <p>© {new Date().getFullYear()} First Medical Center LLC. All rights reserved.</p>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
