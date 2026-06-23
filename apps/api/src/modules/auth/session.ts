import type { FastifyRequest } from "fastify";

import { getSession } from "./store.js";

export const sessionCookieName = "bankroll_session";

export async function getRequestSession(request: FastifyRequest) {
  const signedCookie = request.cookies[sessionCookieName];

  if (!signedCookie) {
    return undefined;
  }

  const token = request.unsignCookie(signedCookie);

  if (!token.valid) {
    return undefined;
  }

  return getSession(token.value);
}
