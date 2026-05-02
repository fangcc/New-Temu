import { timingSafeEqual } from "node:crypto";
import type { Express, Request, Response } from "express";
import { clearAuthCookies, setLocalSessionCookie } from "./authCookies";
import { ENV } from "./env";
import { sdk } from "./sdk";

function timingSafeStringEqual(a: string, b: string) {
  const aBuf = Buffer.from(a, "utf8");
  const bBuf = Buffer.from(b, "utf8");
  if (aBuf.length !== bBuf.length) {
    return false;
  }
  return timingSafeEqual(aBuf, bBuf);
}

function getConfiguredOpenId() {
  if (ENV.localAuthOpenId.trim().length > 0) {
    return ENV.localAuthOpenId.trim();
  }
  return ENV.localAuthEmail.trim();
}

export function registerLocalAuthRoutes(app: Express) {
  app.post("/api/local-auth/login", async (req: Request, res: Response) => {
    const email = typeof req.body?.email === "string" ? req.body.email.trim() : "";
    const password = typeof req.body?.password === "string" ? req.body.password : "";

    if (!ENV.localAuthEmail || !ENV.localAuthPassword) {
      res.status(503).json({ error: "Local auth is not configured" });
      return;
    }

    if (!email || !password) {
      res.status(400).json({ error: "email and password are required" });
      return;
    }

    if (!timingSafeStringEqual(email, ENV.localAuthEmail)) {
      res.status(401).json({ error: "Invalid credentials" });
      return;
    }

    if (!timingSafeStringEqual(password, ENV.localAuthPassword)) {
      res.status(401).json({ error: "Invalid credentials" });
      return;
    }

    const openId = getConfiguredOpenId();
    const name =
      ENV.localAuthDisplayName.trim().length > 0 ? ENV.localAuthDisplayName.trim() : email.split("@")[0] || "User";

    const token = await sdk.signLocalSessionToken(openId, name, email);
    clearAuthCookies(req, res);
    setLocalSessionCookie(req, res, token);

    res.json({ success: true as const });
  });

  app.post("/api/local-auth/logout", (req: Request, res: Response) => {
    clearAuthCookies(req, res);
    res.json({ success: true as const });
  });
}
