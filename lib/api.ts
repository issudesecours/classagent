// Default to 127.0.0.1 so it matches uvicorn on that host and avoids IPv6
// "localhost" quirks on some macOS setups.
export const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE ?? "http://127.0.0.1:8000";

export const WS_BASE =
  process.env.NEXT_PUBLIC_WS_BASE ?? "ws://127.0.0.1:8000";
