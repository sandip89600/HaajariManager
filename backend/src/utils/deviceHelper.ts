import { Request } from "express";
import crypto from "crypto";

export interface DeviceMeta {
  deviceId: string;
  deviceName: string;
  platform: string;
  os: string;
  browser: string;
  ipAddress: string;
  location: string;
}

export const parseUserAgentDetails = (userAgentString?: string) => {
  if (!userAgentString) {
    return { os: "Unknown OS", browser: "Unknown Browser", platform: "Unknown Platform", deviceName: "Unknown Device" };
  }
  let os = "Unknown OS";
  let browser = "Unknown Browser";
  let platform = "Unknown Platform";
  let deviceName = "Unknown Device";

  const ua = userAgentString.toLowerCase();

  if (ua.includes("windows")) {
    os = "Windows";
    platform = "Windows";
    deviceName = "Windows PC";
  } else if (ua.includes("android")) {
    os = "Android";
    platform = "Android";
    deviceName = "Android Device";
  } else if (ua.includes("iphone")) {
    os = "iOS";
    platform = "iOS";
    deviceName = "iPhone";
  } else if (ua.includes("ipad")) {
    os = "iOS";
    platform = "iOS";
    deviceName = "iPad";
  } else if (ua.includes("macintosh") || ua.includes("mac os")) {
    os = "macOS";
    platform = "macOS";
    deviceName = "Mac";
  } else if (ua.includes("linux")) {
    os = "Linux";
    platform = "Linux";
    deviceName = "Linux PC";
  }

  if (ua.includes("chrome") || ua.includes("chromium")) browser = "Chrome";
  else if (ua.includes("safari") && !ua.includes("chrome")) browser = "Safari";
  else if (ua.includes("firefox")) browser = "Firefox";
  else if (ua.includes("edge")) browser = "Edge";
  else if (ua.includes("opera")) browser = "Opera";
  else if (ua.includes("haajari")) browser = "Haajari App";

  return { os, browser, platform, deviceName };
};

export const resolveDeviceMeta = (req: Request): DeviceMeta => {
  const userAgentHeader = (req.headers["user-agent"] as string) || "";
  const headerDeviceId = (req.headers["x-device-id"] as string) || (req.body?.deviceId as string);
  const headerDeviceName = (req.headers["x-device-name"] as string) || (req.body?.deviceName as string);
  const headerPlatform = (req.headers["x-platform"] as string) || (req.body?.platform as string);
  const headerBrowser = (req.headers["x-browser"] as string) || (req.body?.browser as string);

  const parsed = parseUserAgentDetails(userAgentHeader);

  const deviceId = headerDeviceId && headerDeviceId.trim() ? headerDeviceId.trim() : `dev_${crypto.randomBytes(8).toString("hex")}`;
  const deviceName = headerDeviceName && headerDeviceName.trim() ? headerDeviceName.trim() : parsed.deviceName;
  const platform = headerPlatform && headerPlatform.trim() ? headerPlatform.trim() : parsed.platform;
  const browser = headerBrowser && headerBrowser.trim() ? headerBrowser.trim() : parsed.browser;
  const os = parsed.os;

  const rawIp = (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() || req.socket.remoteAddress || req.ip || "127.0.0.1";
  const ipAddress = rawIp.startsWith("::ffff:") ? rawIp.replace("::ffff:", "") : rawIp;

  const headerGeo = (req.headers["x-client-geo"] as string) || (req.body?.location as string);
  const location = headerGeo && headerGeo.trim() ? headerGeo.trim() : resolveApproxLocation(ipAddress);

  return {
    deviceId,
    deviceName,
    platform,
    os,
    browser,
    ipAddress,
    location,
  };
};

export const resolveApproxLocation = (ip: string): string => {
  // If local or internal network IP, return standard location example for testing/dev
  if (
    !ip ||
    ip === "127.0.0.1" ||
    ip === "::1" ||
    ip === "localhost" ||
    ip.startsWith("192.168.") ||
    ip.startsWith("10.") ||
    ip.startsWith("172.")
  ) {
    return "Nashik, Maharashtra, India";
  }
  return "Approximate IP location";
};
