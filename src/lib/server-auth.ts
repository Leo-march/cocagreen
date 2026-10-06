import { createHmac, timingSafeEqual } from "node:crypto";

const SESSION_COOKIE = "cocagreen_admin_session";
const SESSION_DURATION_SECONDS = 8 * 60 * 60;
export const ADMIN_USERNAME = "Talita";

type SessionPayload = {
  username: string;
  expiresAt: number;
};

function requiredEnvironmentValue(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`Configure a variável ${name} no arquivo .env.local.`);
  return value;
}

function getAuthSecret() {
  const secret = requiredEnvironmentValue("COCAGREEN_AUTH_SECRET");
  if (secret.length < 32) {
    throw new Error("COCAGREEN_AUTH_SECRET precisa conter pelo menos 32 caracteres.");
  }
  return secret;
}

function sign(payload: string) {
  return createHmac("sha256", getAuthSecret()).update(payload).digest("base64url");
}

export function createAdminSession() {
  const payload: SessionPayload = {
    username: ADMIN_USERNAME,
    expiresAt: Math.floor(Date.now() / 1000) + SESSION_DURATION_SECONDS,
  };
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${encodedPayload}.${sign(encodedPayload)}`;
}

export function getAdminSession(request: Request): string | null {
  const cookieHeader = request.headers.get("cookie") ?? "";
  const token = cookieHeader
    .split(";")
    .map((cookie) => cookie.trim())
    .find((cookie) => cookie.startsWith(`${SESSION_COOKIE}=`))
    ?.slice(SESSION_COOKIE.length + 1);
  if (!token) return null;

  const [encodedPayload, providedSignature, ...extraParts] = token.split(".");
  if (!encodedPayload || !providedSignature || extraParts.length > 0) return null;

  const expectedSignature = Buffer.from(sign(encodedPayload), "base64url");
  const actualSignature = Buffer.from(providedSignature, "base64url");
  if (
    expectedSignature.length !== actualSignature.length
    || !timingSafeEqual(expectedSignature, actualSignature)
  ) {
    return null;
  }

  try {
    const payload = JSON.parse(
      Buffer.from(encodedPayload, "base64url").toString("utf8"),
    ) as Partial<SessionPayload>;
    if (
      payload.username !== ADMIN_USERNAME
      || typeof payload.expiresAt !== "number"
      || payload.expiresAt <= Math.floor(Date.now() / 1000)
    ) {
      return null;
    }
    return ADMIN_USERNAME;
  } catch {
    return null;
  }
}

export function getSessionCookie(token: string) {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `${SESSION_COOKIE}=${token}; HttpOnly; Path=/; SameSite=Lax; Max-Age=${SESSION_DURATION_SECONDS}${secure}`;
}

export function clearSessionCookie() {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `${SESSION_COOKIE}=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0${secure}`;
}

export function matchesAdminCredentials(username: string, password: string) {
  const expectedPassword = requiredEnvironmentValue("COCAGREEN_ADMIN_PASSWORD");
  const hash = (value: string) => createHmac("sha256", "cocagreen-login-check").update(value).digest();
  return timingSafeEqual(hash(username), hash(ADMIN_USERNAME))
    && timingSafeEqual(hash(password), hash(expectedPassword));
}

export { SESSION_DURATION_SECONDS };
