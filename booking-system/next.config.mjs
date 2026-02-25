/** @type {import('next').NextConfig} */
const nextConfig = {
    // Azure SWA v2 handles Next.js build output natively
    typescript: {
        ignoreBuildErrors: true,
    },
};

export default nextConfig;
