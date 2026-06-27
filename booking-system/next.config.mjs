/** @type {import('next').NextConfig} */
const nextConfig = {
    output: "standalone",
    typescript: {
        ignoreBuildErrors: true,
    },

    outputFileTracingIncludes: {
        '/api/**/*': ['./node_modules/@prisma/client/**/*', './prisma/schema.prisma'],
    },
    outputFileTracingExcludes: {
        '*': [
            'node_modules/@prisma/engines/**/*.node',
            'node_modules/@prisma/client/libquery_engine-debian-openssl-3.0.x.so.node',
            'node_modules/@prisma/client/query_engine-windows.exe.node',
        ],
    },
    experimental: {
    },
};

export default nextConfig;
