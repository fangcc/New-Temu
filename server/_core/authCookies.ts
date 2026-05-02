import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import type { Response } from "express";
import type { Request } from "express";
import { getSessionCookieOptions } from "./cookies";

export const LOCAL_SESSION_COOKIE_NAME = "local_session_id";

export function clearAuthCookies(req: Request, res: Response) {
  const cookieOptions = getSessionCookieOptions(req);
  res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
  res.clearCookie(LOCAL_SESSION_COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
}

export function setLocalSessionCookie(req: Request, res: Response, token: string) {
  const cookieOptions = getSessionCookieOptions(req);
  res.cookie(LOCAL_SESSION_COOKIE_NAME, token, { ...cookieOptions, maxAge: ONE_YEAR_MS });
}
