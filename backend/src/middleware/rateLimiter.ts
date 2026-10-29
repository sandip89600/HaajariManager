import rateLimit from "express-rate-limit";

const isTest = process.env.NODE_ENV === "test";

/**
 * Rate limiter for sensitive login endpoints (/login, /firebase-phone-login, /biometric-login)
 * Allows up to 10 attempts per 15 minutes per IP.
 */
export const loginRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: isTest ? 10000 : 10,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => isTest,
  message: {
    success: false,
    message: "Too many login attempts from this IP. Please wait 15 minutes and try again.",
  },
});

/**
 * Rate limiter for OTP generation and dispatch endpoints (/send-otp, /send-signup-otp, /send-phone-verification-otp)
 * Allows up to 5 OTP requests per 15 minutes per IP to prevent SMS/email gateway exhaustion and spam.
 */
export const otpRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: isTest ? 10000 : 5,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => isTest,
  message: {
    success: false,
    message: "Too many OTP requests. Please wait a few minutes before requesting another code.",
  },
});

/**
 * Rate limiter for account recovery endpoints (/recovery/*, /forgot-password, /reset-password)
 * Allows up to 5 attempts per 15 minutes per IP.
 */
export const recoveryRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: isTest ? 10000 : 5,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => isTest,
  message: {
    success: false,
    message: "Too many recovery attempts. Please wait 15 minutes before trying again.",
  },
});

/**
 * Rate limiter for user signup/registration endpoints (/signup, /register/*)
 * Allows up to 10 registrations per hour per IP.
 */
export const signupRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: isTest ? 10000 : 10,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => isTest,
  message: {
    success: false,
    message: "Too many account registration requests from this IP. Please try again later.",
  },
});
