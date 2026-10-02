import { createHmac, timingSafeEqual } from "node:crypto";

export const SESSION_COOKIE = "cocagreen_session";
export const SESSION_MAX_AGE = 60 * 60 * 24 * 7;

function getAuthSecret() {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error("Configure AUTH_SECRET para habilitar a sessão de acesso.");
  return secret;
}

function sign(payload: string) {
  return createHmac("sha256", getAuthSecret()).update(payload).digest("base64url");
}

export function createSessionToken() {
  const expiresAt = Math.floor(Date.now() / 1000) + SESSION_MAX_AGE;
  const payload = `talita:${expiresAt}`;
  return `${payload}:${sign(payload)}`;
}

export function isValidSession(token?: string) {
  if (!token) return false;
  const [username, expiresAtText, suppliedSignature, ...extra] = token.split(":");
  if (extra.length || username !== "talita" || !expiresAtText || !suppliedSignature) return false;

  const expiresAt = Number(expiresAtText);
  if (!Number.isInteger(expiresAt) || expiresAt <= Math.floor(Date.now() / 1000)) return false;

  try {
    const expectedSignature = sign(`${username}:${expiresAtText}`);
    const expected = Buffer.from(expectedSignature);
    const supplied = Buffer.from(suppliedSignature);
    return expected.length === supplied.length && timingSafeEqual(expected, supplied);
  } catch {
    return false;
  }
}

export const sessionCookieOptions = {
  httpOnly: true,
  sameSite: "strict" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: SESSION_MAX_AGE,
};
