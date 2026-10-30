import "server-only";
import { cookies, headers } from "next/headers";
import { SESSION_COOKIE } from "@/lib/auth-cookie";
import { sha256 } from "@/lib/password";

export async function readSessionToken(): Promise<string | null> {
  return (await cookies()).get(SESSION_COOKIE)?.value ?? null;
}

/** De sessiecookie: alleen voor de server leesbaar, alleen via https in productie. */
export async function setSessionCookie(token: string, expiresAt: Date) {
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

export async function clearSessionCookie() {
  (await cookies()).delete(SESSION_COOKIE);
}

/** Een hash van het IP-adres, om raden te remmen. Het adres zelf bewaren we niet. */
export async function clientIpHash(): Promise<string | null> {
  const h = await headers();
  const ip = h.get("x-real-ip") ?? h.get("x-forwarded-for")?.split(",")[0]?.trim();
  return ip ? sha256(`ip:${ip}`) : null;
}

export function emailHash(email: string): string {
  return sha256(`email:${email}`);
}
