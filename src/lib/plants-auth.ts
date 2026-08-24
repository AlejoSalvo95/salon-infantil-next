import { createHash, timingSafeEqual } from "node:crypto";

export const PLANTS_COOKIE = "nube_plants_session";

function accessKey() {
  return process.env.PLANTS_DASHBOARD_PASSWORD ?? "";
}

function digest(value: string) {
  return createHash("sha256").update(value).digest();
}

export function plantsSessionToken() {
  const key = accessKey();
  return key ? digest(`nube-plants:${key}`).toString("hex") : "";
}

export function isPlantsPasswordValid(password: string) {
  const key = accessKey();
  if (!key) return false;
  const actual = digest(password);
  const expected = digest(key);
  return timingSafeEqual(actual, expected);
}

export function isPlantsSessionValid(value?: string) {
  const token = plantsSessionToken();
  if (!value || !token || value.length !== token.length) return false;
  return timingSafeEqual(Buffer.from(value), Buffer.from(token));
}
