/** @type {import('next').NextConfig} */
const isMobileExport = process.env.MOBILE_EXPORT === 'true';

const nextConfig = {
  reactStrictMode: true,
  output: isMobileExport ? 'export' : undefined,
  trailingSlash: isMobileExport ? true : false,
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
