/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  webpack: (config) => {
    // Silencia o warning conhecido do @supabase/realtime-js sobre require dinâmico
    const matcher = /@supabase[\\/]realtime-js[\\/]dist[\\/]module[\\/]lib[\\/]websocket-factory\.js/
    config.ignoreWarnings = [
      ...(config.ignoreWarnings || []),
      (warning) =>
        typeof warning.message === "string" &&
        warning.message.includes("Critical dependency: the request of a dependency is an expression") &&
        matcher.test(warning.module && warning.module.resource ? warning.module.resource : ""),
    ]
    return config
  },
}

export default nextConfig