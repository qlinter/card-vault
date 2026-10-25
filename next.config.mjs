import imageLimits from "./lib/card-image-limits.js";

/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    proxyClientMaxBodySize: imageLimits.maxCardImageRequestBytes,
    cpus: 1,
    serverActions: {
      bodySizeLimit: imageLimits.maxCardImageRequestBytes
    },
    webpackBuildWorker: false,
    workerThreads: false
  },
  images: {
    unoptimized: true
  }
};

export default nextConfig;
