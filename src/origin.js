import { DEV_ORIGINS } from "./config.js";

export function isAllowedOrigin(origin, allowedOrigin) {
  if (!origin) return true;
  if (origin === allowedOrigin) return true;
  return DEV_ORIGINS.has(origin);
}
