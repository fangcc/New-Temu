import type { CookieOptions, Request } from "express";

function isSecureRequest(req: Request) {
  if (req.protocol === "https") return true;

  const forwardedProto = req.headers["x-forwarded-proto"];
  if (!forwardedProto) return false;

  const protoList = Array.isArray(forwardedProto)
    ? forwardedProto
    : forwardedProto.split(",");

  return protoList.some(proto => proto.trim().toLowerCase() === "https");
}

export function getSessionCookieOptions(
  req: Request
): Pick<CookieOptions, "domain" | "httpOnly" | "path" | "sameSite" | "secure"> {
  // const hostname = req.hostname;
  // const shouldSetDomain =
  //   hostname &&
  //   !LOCAL_HOSTS.has(hostname) &&
  //   !isIpAddress(hostname) &&
  //   hostname !== "127.0.0.1" &&
  //   hostname !== "::1";

  // const domain =
  //   shouldSetDomain && !hostname.startsWith(".")
  //     ? `.${hostname}`
  //     : shouldSetDomain
  //       ? hostname
  //       : undefined;

  const secure = isSecureRequest(req);
  const isProduction = process.env.NODE_ENV === "production";

  // `SameSite=None` requires `Secure=true` in modern browsers. On HTTPS deployments
  // (Railway/Render/etc.) we want `Secure` cookies, and `Lax` is enough for same-site
  // frontend + API on the same origin.
  //
  // For local HTTP dev, keep `Lax` + `Secure=false` so cookies still work.
  return {
    httpOnly: true,
    path: "/",
    sameSite: "lax",
    secure: isProduction ? true : secure,
  };
}
