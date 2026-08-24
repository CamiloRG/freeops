import type { NextConfig } from "next";

// Best-effort hostname extraction for CSP `connect-src`/`img-src` — these
// two vars are the only external origins the browser ever legitimately
// talks to (Supabase Auth/REST, and signed R2 URLs for branding logos).
// Falls back to omitting the origin (never to a wildcard) if a var is
// missing at build time, so a misconfigured env fails closed, not open.
function hostFrom(envVar: string | undefined): string | null {
  if (!envVar) return null;
  try {
    return new URL(envVar).origin;
  } catch {
    return null;
  }
}

const supabaseOrigin = hostFrom(process.env.NEXT_PUBLIC_SUPABASE_URL);
const r2Origin = hostFrom(process.env.R2_ENDPOINT);

const connectSrc = ["'self'", supabaseOrigin].filter(Boolean).join(" ");
const imgSrc = ["'self'", "data:", "blob:", r2Origin].filter(Boolean).join(" ");

// Baseline hardening, not a full Phase-13 pass: Next.js's own inline
// hydration bootstrap needs `'unsafe-inline'` on script/style without
// nonce-based CSP wiring (a further hardening step, not done here) — every
// other directive is locked down (no framing, no plugin objects, no
// cross-origin form posts, no unlisted image/connect origins).
const contentSecurityPolicy = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  `img-src ${imgSrc}`,
  "font-src 'self' data:",
  `connect-src ${connectSrc}`,
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "upgrade-insecure-requests",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: contentSecurityPolicy },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), interest-cohort=()" },
  // 2 years + preload, matches Vercel's own HTTPS-only serving.
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
];

const nextConfig: NextConfig = {
  // `pdfkit` (resume PDF export, Phase 4) reads its standard-14-font AFM
  // metrics files from disk relative to its own package directory at
  // runtime. Left bundled, Next.js's build virtualizes that path (surfaced
  // as `/ROOT/node_modules/.../Helvetica.afm` ENOENT at runtime — caught
  // by this phase's Playwright smoke test) — marking it external keeps it
  // a plain `require()` from `node_modules` so its relative file lookups
  // stay intact. `sharp` (EXIF stripping, R2 uploads) is a native addon
  // with the same class of bundling hazard, added defensively.
  serverExternalPackages: ["pdfkit", "sharp"],
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
