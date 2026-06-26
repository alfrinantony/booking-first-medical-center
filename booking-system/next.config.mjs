/** @type {import('next').NextConfig} */
const nextConfig = {
    typescript: {
        ignoreBuildErrors: true,
    },

    outputFileTracingIncludes: {
        '/api/**/*': ['./node_modules/@prisma/client/**/*', './prisma/schema.prisma'],
    },
    experimental: {
    },
};

export default nextConfig;
