// next.config.mjs
/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async headers() {
    return [{
      source: "/studio",
      headers: [{ key: "Origin-Agent-Cluster", value: "?1" }],
    }];
  },
  // No need for experimental.appDir in Next 14 if you're using /app
};
export default nextConfig;
