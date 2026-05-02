/** @type {import('next').NextConfig} */
const nextConfig = {
    output: 'standalone',
    typescript: {
        ignoreBuildErrors: true,
    },
    experimental: {
        outputFileTracingIncludes: {
            '/api/**/*': ['./node_modules/@prisma/client/**/*', './prisma/schema.prisma'],
        },
    },
};

export default nextConfig;
