import type { NextConfig } from "next";

const securityHeaders = [
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Camera: guests take photos through the file input (no getUserMedia needed).
  { key: "Permissions-Policy", value: "camera=(self), microphone=(), geolocation=(), payment=(), usb=()" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'; base-uri 'self'; form-action 'self' https://gate.chip-in.asia; object-src 'none'" },
];

const nextConfig: NextConfig = {
  // Self-contained server bundle for the VPS (node .next/standalone/server.js).
  output: "standalone",
  // The dev badge sits bottom-left, on top of the guest Upload button.
  devIndicators: false,
  // lib/storage.ts has a dynamic local-storage path, so the tracer pulls in the
  // whole project folder. Never ship local data, credentials notes or test files.
  // The caption-on-download renderer reads this font at runtime (the server has no fonts).
  outputFileTracingIncludes: {
    "/api/e/[slug]/photos/[id]/download": ["./assets/fonts/*.woff"],
    "/api/events/[id]/card": ["./assets/fonts/*.woff"],
  },
  outputFileTracingExcludes: {
    "/*": [
      "./*.txt",
      "./*.log",
      "./.env*",
      "./.local-db/**/*",
      "./.local-storage/**/*",
      "./docs/**/*",
      "./e2e/**/*",
      "./test-results/**/*",
      "./playwright-report/**/*",
      "./supabase/**/*",
      "./scripts/**/*",
      "./deploy/**/*",
      "./worker/**/*",
    ],
  },
  poweredByHeader: false,
  async headers() {
    // Images in public/ (landing screenshots, brand art, icons) aren't hashed, so Next
    // sends max-age=0 and Cloudflare goes back to Singapore for every one — slow when a
    // visitor is routed to a far-away Cloudflare site. Let browsers keep them a day and
    // Cloudflare serve them from its cache, refreshing in the background.
    const publicCache = [{ key: "Cache-Control", value: "public, max-age=86400, s-maxage=604800, stale-while-revalidate=604800" }];
    return [
      { source: "/:path*", headers: securityHeaders },
      { source: "/landing/:file*", headers: publicCache },
      { source: "/brand/:file*", headers: publicCache },
      { source: "/demo/:file(.+\\.jpg)", headers: publicCache },
      { source: "/:icon(icon-192.png|icon-512.png|icon-maskable-512.png)", headers: publicCache },
    ];
  },
  experimental: {
    serverActions: { bodySizeLimit: "12mb" }, // cover / logo uploads
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
