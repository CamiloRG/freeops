import type { NextConfig } from "next";

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
};

export default nextConfig;
