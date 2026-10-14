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
  // lib/storage.ts has a dynamic local-storage path, so the tracer pulls in the
  // whole project folder. Never ship local data, credentials notes or test files.
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
    return [{ source: "/:path*", headers: securityHeaders }];
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
