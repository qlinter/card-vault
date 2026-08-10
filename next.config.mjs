/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    cpus: 1,
    serverActions: {
      bodySizeLimit: "20mb"
    },
    webpackBuildWorker: false,
    workerThreads: false
  },
  images: {
    unoptimized: true
  }
};

export default nextConfig;
