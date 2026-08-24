import { createHash, createHmac, timingSafeEqual } from "node:crypto";

export const PLANTS_COOKIE = "nube_plants_session";
export const PLANTS_SESSION_SECONDS = 60 * 10;

function accessKey() {
  return process.env.PLANTS_DASHBOARD_PASSWORD ?? "";
}

function digest(value: string) {
  return createHash("sha256").update(value).digest();
}

function sessionSignature(issuedAt: string, key: string) {
  return createHmac("sha256", key).update(`nube-plants:${issuedAt}`).digest("hex");
}

export function plantsSessionToken() {
  const key = accessKey();
  if (!key) return "";
  const issuedAt = Math.floor(Date.now() / 1000).toString();
  return `${issuedAt}.${sessionSignature(issuedAt, key)}`;
}

export function isPlantsPasswordValid(password: string) {
  const key = accessKey();
  if (!key) return false;
  const actual = digest(password);
  const expected = digest(key);
  return timingSafeEqual(actual, expected);
}

export function isPlantsSessionValid(value?: string) {
  const key = accessKey();
  if (!value || !key) return false;
  const [issuedAt, suppliedSignature, extra] = value.split(".");
  if (!issuedAt || !suppliedSignature || extra) return false;
  const issuedAtSeconds = Number(issuedAt), now = Math.floor(Date.now() / 1000);
  if (!Number.isInteger(issuedAtSeconds) || issuedAtSeconds > now + 30 || now - issuedAtSeconds >= PLANTS_SESSION_SECONDS) return false;
  const expectedSignature = sessionSignature(issuedAt, key);
  if (suppliedSignature.length !== expectedSignature.length) return false;
  return timingSafeEqual(Buffer.from(suppliedSignature), Buffer.from(expectedSignature));
}
