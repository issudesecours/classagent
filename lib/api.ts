// Local dev: http / ws on 127.0.0.1 (avoids IPv6 "localhost" quirks on macOS).
// Vercel builds: VERCEL=1 → defaults to production API (override with NEXT_PUBLIC_*).
// You can always set NEXT_PUBLIC_API_BASE / NEXT_PUBLIC_WS_BASE in Vercel or .env.local.

const PROD_API = "https://api.valerydev.org";
const PROD_WS = "wss://api.valerydev.org";

const onVercel = Boolean(process.env.VERCEL);

export const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE ??
  (onVercel ? PROD_API : "http://127.0.0.1:8000");

export const WS_BASE =
  process.env.NEXT_PUBLIC_WS_BASE ??
  (onVercel ? PROD_WS : "ws://127.0.0.1:8000");
