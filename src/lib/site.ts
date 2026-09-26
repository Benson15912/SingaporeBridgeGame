// Canonical site URL. Set NEXT_PUBLIC_SITE_URL once you have a custom domain;
// until then Vercel's production domain is used automatically.
export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL ??
  (process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : "http://localhost:3000")
).replace(/\/$/, "");

export const SITE_NAME = "Floating Bridge";
export const SITE_TITLE = "Floating Bridge – Play Singapore Bridge Online with Friends";
export const SITE_DESCRIPTION =
  "Play Floating Bridge (Singapore Bridge / Bridge) online for free with 3 friends. No sign-up: create a room, share the code and deal. Works on phone and desktop.";
