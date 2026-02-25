/** @type {import('next').NextConfig} */
const nextConfig = {
    // Azure SWA v2 handles Next.js build output natively
    eslint: {
        ignoreDuringBuilds: true,
    },
    typescript: {
        ignoreBuildErrors: true,
    },
};

export default nextConfig;
