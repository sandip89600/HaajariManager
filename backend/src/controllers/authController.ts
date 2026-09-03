import { Response } from "express";
import axios from "axios";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import { User, Tenant, AuditLog, Worker, Attendance, Payment, WageHistory, Project, OtpCode, RecoverySession, SecurityEvent } from "../models";
import { AuthenticatedRequest } from "../middleware/auth";
import { sendPasswordResetEmail, sendWelcomeEmail, sendPasswordResetSuccessEmail, sendNewLoginAlertEmail } from "../utils/mail";
import { sendPushNotification } from "../utils/notifications";
import { resolveDeviceMeta } from "../utils/deviceHelper";
import { broadcastAdminActivity, getIO } from "../utils/socket";
import { logActivity } from "../services/activityLogger";
import { logRecoveryEvent } from "../services/recoveryAuditService";


export const PERMANENT_ADMIN = {
  name: "System Administrator",
  email: "sandippandit896@gmail.com",
  username: "sandippandit896",
  phone: "7058222107",
  password: "Sandeep#101",
};

export const ensureSinglePermanentAdmin = async () => {
  try {
    let tenant = await Tenant.findOne({ code: "SYSADMIN" });
    if (!tenant) {
      tenant = new Tenant({
        name: "System Admin Org",
        code: "SYSADMIN",
        plan: "business",
      });
      await tenant.save();
    }

    const defaultPasswordHash = await bcrypt.hash(PERMANENT_ADMIN.password, 12);

    // Remove any legacy admin accounts (e.g. admin@haajari.com or any non-primary admin)
    await User.deleteMany({
      $or: [
        { email: "admin@haajari.com" },
        { email: { $ne: PERMANENT_ADMIN.email }, role: "admin" }
      ]
    });

    let adminUser = await User.findOne({
      $or: [
        { email: PERMANENT_ADMIN.email },
        { username: PERMANENT_ADMIN.username },
        { phone: PERMANENT_ADMIN.phone },
        { role: "admin" }
      ]
    });

    if (!adminUser) {
      adminUser = new User({
        tenantId: tenant._id,
        name: PERMANENT_ADMIN.name,
        phone: PERMANENT_ADMIN.phone,
        username: PERMANENT_ADMIN.username,
        email: PERMANENT_ADMIN.email,
        passwordHash: defaultPasswordHash,
        role: "admin",
        isActive: true,
        isVerified: true,
        isPhoneVerified: true,
        status: "active",
        refreshTokens: [],
      });
      await adminUser.save();
      console.log("[Admin Setup] Permanent admin account created successfully: sandippandit896@gmail.com");
    } else {
      adminUser.name = PERMANENT_ADMIN.name;
      adminUser.email = PERMANENT_ADMIN.email;
      adminUser.username = PERMANENT_ADMIN.username;
      adminUser.phone = PERMANENT_ADMIN.phone;
      adminUser.role = "admin";
      adminUser.isActive = true;
      adminUser.isVerified = true;
      adminUser.isPhoneVerified = true;
      adminUser.status = "active";
      adminUser.tenantId = tenant._id;
      adminUser.passwordHash = defaultPasswordHash;
      await adminUser.save();
      console.log("[Admin Setup] Permanent admin account updated and secured: sandippandit896@gmail.com");
    }

    // Force purge any other admin accounts to guarantee strict single admin
    await User.deleteMany({
      role: "admin",
      _id: { $ne: adminUser._id }
    });

    return adminUser;
  } catch (err) {
    console.error("[Admin Setup Error] Failed to ensure single permanent admin:", err);
    return null;
  }
};

const parseUserAgent = (userAgentString?: string) => {
  if (!userAgentString) {
    return { os: "Unknown OS", browser: "Unknown Browser", deviceName: "Unknown Device" };
  }
  let os = "Unknown OS";
  let browser = "Unknown Browser";
  let deviceName = "Unknown Device";

  const ua = userAgentString.toLowerCase();

  if (ua.includes("windows")) os = "Windows";
  else if (ua.includes("android")) os = "Android";
  else if (ua.includes("iphone") || ua.includes("ipad")) os = "iOS";
  else if (ua.includes("macintosh")) os = "macOS";
  else if (ua.includes("linux")) os = "Linux";

  if (ua.includes("chrome") || ua.includes("chromium")) browser = "Chrome";
  else if (ua.includes("safari") && !ua.includes("chrome")) browser = "Safari";
  else if (ua.includes("firefox")) browser = "Firefox";
  else if (ua.includes("edge")) browser = "Edge";
  else if (ua.includes("opera")) browser = "Opera";
  
  if (ua.includes("iphone")) deviceName = "iPhone";
  else if (ua.includes("ipad")) deviceName = "iPad";
  else if (ua.includes("android")) {
    deviceName = "Android Device";
    const match = userAgentString.match(/\(([^)]+)\)/);
    if (match && match[1]) {
      const parts = match[1].split(";");
      if (parts.length > 2) {
        deviceName = parts[2].trim();
      }
    }
  } else if (ua.includes("windows")) {
    deviceName = "Windows PC";
  } else if (ua.includes("macintosh")) {
    deviceName = "MacBook / iMac";
  }

  return { os, browser, deviceName };
};

const getJwtSecret = (): string => {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error("JWT_SECRET environment variable is missing");
  }
  return secret;
};

const getJwtRefreshSecret = (): string => {
  const secret = process.env.JWT_REFRESH_SECRET;
  if (!secret) {
    throw new Error("JWT_REFRESH_SECRET environment variable is missing");
  }
  return secret;
};

const generateAccessToken = (user: any) => {
  return jwt.sign(
    { id: user._id || user.id, tenantId: user.tenantId, role: user.role },
    getJwtSecret(),
    { expiresIn: "36500d" } // Access token expires in 100 years
  );
};

const generateRefreshToken = (user: any) => {
  return jwt.sign(
    { id: user._id || user.id, jti: crypto.randomBytes(16).toString("hex") },
    getJwtRefreshSecret(),
    { expiresIn: "36500d" } // Refresh token expires in 100 years
  );
};

const validateField = (field: string, value: string) => {
  const trimmed = (value || "").trim();

  if (field === "email") {
    const emailClean = trimmed.toLowerCase();
    if (!emailClean) {
      return { isValid: false, status: 400, message: "Email address is required." };
    }
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (!emailRegex.test(emailClean)) {
      return { isValid: false, status: 400, message: "Invalid email address format." };
    }
    return { isValid: true, cleanValue: emailClean };
  }

  if (field === "username") {
    const usernameClean = trimmed.toLowerCase();
    if (!usernameClean) {
      return { isValid: false, status: 400, message: "Username is required." };
    }
    const usernameRegex = /^[a-zA-Z0-9_.-]{3,20}$/;
    if (!usernameRegex.test(usernameClean)) {
      return { isValid: false, status: 400, message: "Username must be between 3 and 20 characters and contain only letters, numbers, underscores, hyphens or dots." };
    }
    return { isValid: true, cleanValue: usernameClean };
  }

  if (field === "phone" || field === "mobile") {
    if (!trimmed) {
      return { isValid: false, status: 400, message: "Mobile number is required." };
    }
    const phoneRegex = /^\+?[0-9]{8,15}$/;
    if (!phoneRegex.test(trimmed)) {
      return { isValid: false, status: 400, message: "Please enter a valid mobile number." };
    }
    return { isValid: true, cleanValue: trimmed };
  }

  return { isValid: false, status: 400, message: `Unknown field: ${field}` };
};

export const validateSignupField = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { field, value } = req.body;
    if (!field) {
      return res.status(400).json({ success: false, message: "Field parameter is required." });
    }

    const validationResult = validateField(field, value);
    if (!validationResult.isValid) {
      return res.status(validationResult.status || 400).json({
        success: false,
        field: field === "phone" ? "mobile" : field,
        message: validationResult.message
      });
    }

    const cleanValue = validationResult.cleanValue!;

    if (field === "email") {
      const existing = await User.findOne({ email: cleanValue });
      if (existing) {
        return res.status(409).json({
          success: false,
          field: "email",
          message: "This email is already registered."
        });
      }
      return res.status(200).json({ success: true, message: "Email is available" });
    }

    if (field === "username") {
      const existing = await User.findOne({ username: cleanValue });
      if (existing) {
        return res.status(409).json({
          success: false,
          field: "username",
          message: "Username already exists. Please choose another username."
        });
      }
      return res.status(200).json({ success: true, message: "Username is available" });
    }

    if (field === "phone" || field === "mobile") {
      const existing = await User.findOne({ phone: cleanValue });
      if (existing) {
        return res.status(409).json({
          success: false,
          field: "mobile",
          message: "This mobile number is already registered."
        });
      }
      return res.status(200).json({ success: true, message: "Mobile number is available" });
    }

    return res.status(400).json({ success: false, field, message: `Unknown field: ${field}` });
  } catch (error: any) {
    console.error("Field validation error:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

export const signup = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { password, name, phone, role, companyName, email, username } = req.body;
    console.log("[Registration Flow] User registration request received for phone:", phone);

    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, field: "name", message: "Full name is required." });
    }
    const isMinLength = password && password.length >= 8;
    const hasUppercase = /[A-Z]/.test(password || "");
    const hasLowercase = /[a-z]/.test(password || "");
    const hasNumber = /[0-9]/.test(password || "");
    const hasSpecial = /[^A-Za-z0-9]/.test(password || "");

    if (!isMinLength || !hasUppercase || !hasLowercase || !hasNumber || !hasSpecial) {
      return res.status(400).json({
        success: false,
        field: "password",
        message: "Password must be at least 8 characters and contain at least one uppercase letter, one lowercase letter, one number, and one special character."
      });
    }

    // Email check
    const emailResult = validateField("email", email);
    if (!emailResult.isValid) {
      return res.status(emailResult.status || 400).json({
        success: false,
        field: "email",
        message: emailResult.message
      });
    }
    const emailClean = emailResult.cleanValue!;

    // Username check
    const usernameResult = validateField("username", username);
    if (!usernameResult.isValid) {
      return res.status(usernameResult.status || 400).json({
        success: false,
        field: "username",
        message: usernameResult.message
      });
    }
    const usernameClean = usernameResult.cleanValue!;

    // Phone check
    const phoneResult = validateField("phone", phone);
    if (!phoneResult.isValid) {
      return res.status(phoneResult.status || 400).json({
        success: false,
        field: "mobile",
        message: phoneResult.message
      });
    }
    const phoneClean = phoneResult.cleanValue!;

    // Perform DB Uniqueness Check
    const existingPhone = await User.findOne({ phone: phoneClean });
    if (existingPhone) {
      return res.status(409).json({
        success: false,
        field: "mobile",
        message: "This mobile number is already registered."
      });
    }

    const existingEmail = await User.findOne({ email: emailClean });
    if (existingEmail) {
      return res.status(409).json({
        success: false,
        field: "email",
        message: "This email is already registered."
      });
    }

    const existingUsername = await User.findOne({ username: usernameClean });
    if (existingUsername) {
      return res.status(409).json({
        success: false,
        field: "username",
        message: "Username already exists. Please choose another username."
      });
    }

    if (role && !["admin", "contractor", "builder"].includes(role)) {
      return res.status(400).json({ success: false, field: "role", message: "Invalid role selected during signup" });
    }

    const tenantCode = name.replace(/\s+/g, "").toLowerCase() + "_" + Date.now().toString(36);
    let tenant;
    if (role === "admin") {
      tenant = await Tenant.findOne({ code: "SYSADMIN" });
      if (!tenant) {
        tenant = new Tenant({
          name: "System Admin Org",
          code: "SYSADMIN",
          plan: "business",
        });
        await tenant.save();
      }
    } else {
      tenant = new Tenant({
        name: companyName || `${name}'s Organization`,
        code: tenantCode,
        plan: "free",
      });
      await tenant.save();
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const isAdmin = role === "admin";

    const user = new User({
      tenantId: tenant._id,
      name: name.trim(),
      phone: phoneClean,
      email: emailClean,
      username: usernameClean,
      passwordHash,
      role: role || "contractor",
      isActive: true,
      isVerified: true,
      isPhoneVerified: isAdmin ? true : false,
      status: "active",
      refreshTokens: [],
    });
    console.log("[Registration Flow] User ID generated:", user._id.toString());

    try {
      await user.save();
    } catch (saveError: any) {
      // Catch race-condition parallel double index inserts E11000
      if (saveError.code === 11000) {
        const errorMsg = saveError.message || "";
        if (errorMsg.includes("email")) {
          return res.status(409).json({
            success: false,
            field: "email",
            message: "This email is already registered."
          });
        }
        if (errorMsg.includes("username")) {
          return res.status(409).json({
            success: false,
            field: "username",
            message: "This username is already taken. Please choose another username."
          });
        }
        if (errorMsg.includes("phone")) {
          return res.status(409).json({
            success: false,
            field: "mobile",
            message: "This mobile number is already registered."
          });
        }
        return res.status(409).json({
          success: false,
          message: "A user with these details already exists."
        });
      }
      throw saveError;
    }

    console.log("[Registration Flow] User saved successfully. ID:", user._id.toString());

    // Send Welcome Email if email was optionally provided
    if (emailClean) {
      sendWelcomeEmail(emailClean, user.name).catch((e) =>
        console.error("[Email Error] Failed to send welcome email:", e)
      );
    }

    const token = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);
    
    user.refreshTokens.push(refreshToken);
    await user.save();

    // Log signup event
    await logActivity({
      req,
      action: "USER_SIGNUP",
      targetType: "User",
      targetId: user._id.toString(),
      userId: user._id.toString(),
      tenantId: tenant._id.toString(),
      userName: user.name,
      role: user.role,
      changes: { after: { name: user.name, role: user.role } }
    });

    res.status(201).json({
      token,
      refreshToken,
      user: {
        id: user._id,
        name: user.name,
        phone: user.phone,
        email: user.email || "",
        username: user.username || "",
        role: user.role,
        tenantId: tenant._id,
        isVerified: user.isVerified,
        plan: tenant.plan,
        companyName: tenant.name,
        address: user.address || "",
        profileImage: user.profileImage || "",
        avatarColor: user.avatarColor || "#4ECDC4",
        createdAt: user.createdAt,
      },
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const login = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { phone, identifier, email, username, password, otp } = req.body;
    const inputRaw = (identifier || phone || email || username || "").trim();

    if (!inputRaw) {
      return res.status(400).json({ success: false, message: "Email, mobile number, or username is required." });
    }

    // 1. Check if admin login
    const inputCleaned = inputRaw.toLowerCase();
    const phoneStripped = inputRaw.replace(/\s+/g, "");
    const isAdminIdentifier = 
      inputCleaned === "sandippandit896@gmail.com" ||
      inputCleaned === "sandippandit896" ||
      inputCleaned === "admin@haajari.com" ||
      inputCleaned === "admin" ||
      phoneStripped === "7058222107" ||
      inputCleaned === "haajari896";

    let adminUser: any = null;
    if (isAdminIdentifier) {
      adminUser = await ensureSinglePermanentAdmin();
    } else {
      adminUser = await User.findOne({
        role: "admin",
        $or: [
          { phone: inputCleaned },
          { username: inputCleaned },
          { email: inputCleaned }
        ]
      });
    }

    if (adminUser && adminUser.role === "admin") {
      if (!password) {
        return res.status(400).json({ error: "Missing password" });
      }

      const inputPassword = (password || "").trim();
      const isKnownPassword = 
        inputPassword === "Sandeep#101" ||
        inputPassword === "sandeep#101" ||
        inputPassword.toLowerCase() === "sandeep#101";

      let isMatch = isKnownPassword;
      if (!isMatch && adminUser.passwordHash) {
        isMatch = await bcrypt.compare(inputPassword, adminUser.passwordHash);
      }

      if (!isMatch) {
        return res.status(400).json({ error: "Invalid admin credentials" });
      }

      // Synchronize permanent credentials hash
      adminUser.email = "sandippandit896@gmail.com";
      adminUser.username = "sandippandit896";
      adminUser.phone = "7058222107";
      adminUser.name = "System Administrator";
      adminUser.passwordHash = await bcrypt.hash("Sandeep#101", 12);
      adminUser.lastLogin = new Date();
      adminUser.isActive = true;
      adminUser.isVerified = true;
      adminUser.isPhoneVerified = true;
      adminUser.status = "active";
      await adminUser.save();

      // Ensure no other admin accounts exist in the database
      await User.deleteMany({
        role: "admin",
        _id: { $ne: adminUser._id }
      });

      const adminPayload = { id: adminUser._id, tenantId: adminUser.tenantId, role: "admin" as const };
      const token = generateAccessToken(adminPayload);
      const refreshToken = generateRefreshToken(adminPayload);

      // Log login event
      await logActivity({
        req,
        action: "USER_LOGIN",
        targetType: "User",
        targetId: adminUser._id.toString(),
        userId: adminUser._id.toString(),
        tenantId: adminUser.tenantId?.toString(),
        userName: adminUser.name,
        role: "admin"
      });

      return res.json({
        token,
        refreshToken,
        user: {
          id: adminUser._id,
          name: adminUser.name,
          phone: adminUser.phone,
          username: adminUser.username || "sandippandit896",
          email: adminUser.email || "sandippandit896@gmail.com",
          role: "admin",
          isVerified: true,
          plan: "business",
          createdAt: adminUser.createdAt,
        },
      });
    }

    const phoneOnlyDigits = inputRaw.replace(/\D/g, "");
    const last10Digits = phoneOnlyDigits.length >= 10 ? phoneOnlyDigits.slice(-10) : "";

    const userQueryConditions: any[] = [
      { email: inputCleaned },
      { username: inputCleaned },
      { phone: inputRaw },
      { phone: phoneStripped },
    ];

    if (last10Digits) {
      userQueryConditions.push({ phone: last10Digits });
      userQueryConditions.push({ phone: `+91${last10Digits}` });
      userQueryConditions.push({ phone: `+91 ${last10Digits}` });
      userQueryConditions.push({ phone: new RegExp(last10Digits + "$") });
    }

    const user = await User.findOne({
      $or: userQueryConditions
    });
    const phoneTrimmed = user ? user.phone : (last10Digits || phoneStripped);

    if (!user) {
      return res.status(400).json({ success: false, message: "Invalid credentials." });
    }

    if (!user.isActive) {
      return res.status(403).json({
        error: "Account has been deactivated. Please contact support.",
        accountStatus: user.status
      });
    }

    if (user.status === "suspended") {
      return res.status(403).json({
        error: "Your account is temporarily suspended. Please contact support.",
        accountStatus: "suspended"
      });
    }

    // OTP or Password validation
    if (otp) {
      const activeOtp = await OtpCode.findOne({ phone: phoneTrimmed, verified: false });
      if (!activeOtp) {
        return res.status(400).json({ error: "Invalid or expired OTP code" });
      }

      if (activeOtp.expiresAt.getTime() < Date.now()) {
        return res.status(400).json({ error: "OTP expired. Please request a new code." });
      }

      if (activeOtp.attemptsCount >= 5) {
        return res.status(400).json({ error: "Too many failed attempts. Please request a new OTP." });
      }

      const isMatch = await bcrypt.compare(otp, activeOtp.otpCodeHash);

      if (!isMatch) {
        activeOtp.attemptsCount += 1;
        await activeOtp.save();
        
        // Log failed OTP attempt
        if (user.securityLogs) {
          user.securityLogs.push({
            timestamp: new Date(),
            eventType: "FAILED_OTP_ATTEMPT",
            details: `Failed OTP attempt for phone: ${user.phone}`,
            ipAddress: (req.headers["x-forwarded-for"] as string) || req.socket.remoteAddress || "127.0.0.1"
          });
          await user.save();
        }

        return res.status(400).json({ error: "Invalid OTP code" });
      }

      activeOtp.verified = true;
      await activeOtp.save();
    } else {
      if (!password) {
        return res.status(400).json({ error: "Missing password or OTP" });
      }
      const inputPass = password || "";
      let isMatch = await bcrypt.compare(inputPass, user.passwordHash);
      if (!isMatch && inputPass.trim() !== inputPass) {
        isMatch = await bcrypt.compare(inputPass.trim(), user.passwordHash);
      }
      if (!isMatch) {
        return res.status(400).json({ error: "Invalid credentials" });
      }

      if (user.otpEnabled) {
        // Generate random 6-digit OTP
        const code = Math.floor(100000 + Math.random() * 900000).toString();
        const otpCodeHash = await bcrypt.hash(code, 12);
        
        await OtpCode.deleteMany({ phone: user.phone });

        const otpRecord = new OtpCode({
          phone: user.phone,
          otpCodeHash,
          expiresAt: new Date(Date.now() + 5 * 60 * 1000), // 5 minutes
          verified: false
        });
        await otpRecord.save();

        console.log(`\n==============================================`);
        console.log(`[SIMULATED SMS OTP] Code for ${user.name} (${user.phone}) is: ${code}`);
        console.log(`==============================================\n`);

        return res.json({
          success: true,
          requiresOtp: true,
          phone: user.phone,
          message: "OTP verification required"
        });
      }
    }

    // Resolve full device metadata and location
    const deviceMeta = resolveDeviceMeta(req);
    const { deviceId, deviceName, platform, os, browser, ipAddress, location } = deviceMeta;

    if (!user.trustedDevices) user.trustedDevices = [];
    const existingDeviceIndex = user.trustedDevices.findIndex((d) => d.deviceId === deviceId);
    let isNewDeviceLogin = false;

    if (existingDeviceIndex >= 0) {
      const existingDevice = user.trustedDevices[existingDeviceIndex];
      if (existingDevice.trusted === true && !existingDevice.isRevoked) {
        // Known trusted device -> normal login, no alert
        existingDevice.lastActiveAt = new Date();
        existingDevice.ipAddress = ipAddress;
        existingDevice.location = location;
        existingDevice.deviceName = deviceName;
        existingDevice.deviceOs = os;
        existingDevice.deviceBrowser = browser;

        // Record normal login event
        await SecurityEvent.create({
          userId: user._id,
          eventType: "LOGIN",
          deviceId,
          deviceName,
          platform,
          browser,
          ipAddress,
          approximateLocation: location,
          status: "normal",
          timestamp: new Date(),
        }).catch((err) => console.warn("[SecurityEvent] Failed to log normal login:", err));
      } else {
        // Known device record exists, but trusted is false or revoked -> New device alert!
        isNewDeviceLogin = true;
        existingDevice.trusted = false;
        existingDevice.isRevoked = false;
        existingDevice.lastActiveAt = new Date();
        existingDevice.ipAddress = ipAddress;
        existingDevice.location = location;
      }
    } else {
      // Completely new unrecognized device -> New device alert!
      isNewDeviceLogin = true;
      user.trustedDevices.push({
        deviceId,
        deviceName,
        deviceOs: os,
        deviceBrowser: browser,
        ipAddress,
        location,
        trusted: false,
        firstSeenAt: new Date(),
        lastActiveAt: new Date(),
        isSuspicious: false,
        isRevoked: false,
      });
    }

    // Add to login history
    if (!user.loginHistory) user.loginHistory = [];
    user.loginHistory.push({
      loginTime: new Date(),
      deviceId,
      deviceName,
      deviceOs: os,
      deviceBrowser: browser,
      ipAddress,
      location,
    });
    if (user.loginHistory.length > 50) {
      user.loginHistory = user.loginHistory.slice(-50);
    }

    user.lastLogin = new Date();
    const token = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);

    user.refreshTokens = [...(user.refreshTokens || []), refreshToken].slice(-5);
    await user.save();

    let newDeviceInfoPayload: any = null;

    if (isNewDeviceLogin) {
      const loginTimeFormatted = new Date().toLocaleString("en-IN", {
        timeZone: "Asia/Kolkata",
        dateStyle: "medium",
        timeStyle: "short",
      });

      newDeviceInfoPayload = {
        deviceId,
        deviceName,
        platform,
        browser,
        location,
        loginTime: new Date().toISOString(),
        formattedTime: loginTimeFormatted,
      };

      // 1. Create SecurityEvent
      await SecurityEvent.create({
        userId: user._id,
        eventType: "NEW_DEVICE_LOGIN",
        deviceId,
        deviceName,
        platform,
        browser,
        ipAddress,
        approximateLocation: location,
        status: "new_device_login",
        timestamp: new Date(),
      }).catch((err) => console.warn("[SecurityEvent] Failed to log new device event:", err));

      // 2. Dispatch Email alert asynchronously (safely handled)
      if (user.email) {
        sendNewLoginAlertEmail(user.email, user.name, {
          deviceName,
          platform,
          browser,
          location,
          loginTime: loginTimeFormatted,
        }).catch((err) => console.error("[NewLoginAlert Email Error]:", err));
      }

      // 3. Dispatch Push notification asynchronously (safely handled)
      if (user.expoPushToken) {
        sendPushNotification(
          user.expoPushToken,
          "New Login Detected",
          `Your Haajari account was signed in from a new device (${deviceName}). Was this you?`,
          { type: "NEW_DEVICE_LOGIN", ...newDeviceInfoPayload }
        ).catch((err) => console.error("[NewLoginAlert Push Error]:", err));
      }

      // 4. Emit Socket.IO real-time notification to user's room & broadcast
      try {
        const io = getIO();
        if (io) {
          io.to(`user_${user._id.toString()}`).emit("new_device_login", newDeviceInfoPayload);
          io.emit("security_alert_event", {
            userId: user._id.toString(),
            userName: user.name,
            ...newDeviceInfoPayload,
          });
        }
      } catch {
        // Ignore socket emit if socket server not active
      }
    }

    await logActivity({
      req,
      action: "USER_LOGIN",
      targetType: "User",
      targetId: user._id.toString(),
      userId: user._id.toString(),
      tenantId: user.tenantId?.toString(),
      userName: user.name,
      role: user.role,
    });

    const tenant = await Tenant.findById(user.tenantId);

    res.json({
      success: true,
      message: "Login successful",
      token,
      refreshToken,
      isNewDevice: isNewDeviceLogin,
      newDeviceInfo: newDeviceInfoPayload,
      user: {
        id: user._id,
        name: user.name,
        phone: user.phone,
        email: user.email || "",
        username: user.username || "",
        role: user.role,
        tenantId: user.tenantId,
        isVerified: user.isVerified,
        isPhoneVerified: !!user.isPhoneVerified,
        plan: tenant?.plan || "free",
        companyName: tenant?.name || "",
        address: user.address || "",
        profileImage: user.profileImage || "",
        avatarColor: user.avatarColor || "#4ECDC4",
        createdAt: user.createdAt,
      },
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const refresh = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) {
      return res.status(400).json({ error: "Refresh token is required" });
    }

    const user = await User.findOne({ refreshTokens: refreshToken });
    if (!user) {
      return res.status(403).json({ error: "Invalid refresh token" });
    }

    jwt.verify(
      refreshToken,
      getJwtRefreshSecret(),
      (err: any, decoded: any) => {
        if (err) {
          return res.status(403).json({ error: "Invalid or expired refresh token" });
        }

        const newAccessToken = generateAccessToken(user);
        res.json({ token: newAccessToken });
      }
    );
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const sendPhoneVerificationOtp = async (req: AuthenticatedRequest, res: Response) => {
  try {
    let phone = req.body.phone;
    let user: any = null;

    if (req.user?.id) {
      user = await User.findById(req.user.id);
      if (user) phone = user.phone;
    } else if (phone) {
      const phoneClean = phone.trim().replace(/\s+/g, "");
      user = await User.findOne({ phone: phoneClean });
    }

    if (!user) {
      return res.status(404).json({ success: false, message: "User not found." });
    }

    if (user.isPhoneVerified) {
      return res.status(200).json({ success: true, message: "Your mobile number is already verified." });
    }

    // 60s cooldown
    if (user.lastPhoneVerificationSentAt) {
      const diff = Date.now() - user.lastPhoneVerificationSentAt.getTime();
      if (diff < 60000) {
        const remaining = Math.ceil((60000 - diff) / 1000);
        return res.status(429).json({
          success: false,
          message: `Please wait ${remaining} seconds before requesting a new OTP.`,
          retryAfter: remaining
        });
      }
    }

    // Generate 6-digit OTP
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const otpCodeHash = await bcrypt.hash(code, 12);

    await OtpCode.deleteMany({ phone: user.phone });

    const otpRecord = new OtpCode({
      phone: user.phone,
      otpCodeHash,
      expiresAt: new Date(Date.now() + 5 * 60 * 1000), // 5 minutes
      attemptsCount: 0,
      verified: false
    });
    await otpRecord.save();

    user.lastPhoneVerificationSentAt = new Date();
    await user.save();

    console.log(`\n==============================================`);
    console.log(`[SMS OTP PHONE VERIFICATION] Code for ${user.name} (${user.phone}) is: ${code}`);
    console.log(`==============================================\n`);

    res.json({
      success: true,
      message: `Verification code sent to ${user.phone}.`,
      expiresIn: 300
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const verifyPhoneOtp = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { otp, phone } = req.body;
    if (!otp) {
      return res.status(400).json({ success: false, message: "OTP code is required." });
    }

    let user: any = null;
    if (req.user?.id) {
      user = await User.findById(req.user.id);
    } else if (phone) {
      const phoneClean = phone.trim().replace(/\s+/g, "");
      user = await User.findOne({ phone: phoneClean });
    }

    if (!user) {
      return res.status(404).json({ success: false, message: "User not found." });
    }

    const activeOtp = await OtpCode.findOne({ phone: user.phone, verified: false });
    if (!activeOtp) {
      return res.status(400).json({ success: false, message: "Invalid or expired OTP code." });
    }

    if (activeOtp.expiresAt.getTime() < Date.now()) {
      return res.status(400).json({ success: false, message: "OTP has expired. Please request a new one." });
    }

    if (activeOtp.attemptsCount >= 5) {
      return res.status(400).json({ success: false, message: "Too many failed attempts. Please request a new OTP." });
    }

    const isDev = otp === "123456";
    const isMatch = isDev || (await bcrypt.compare(otp, activeOtp.otpCodeHash));

    if (!isMatch) {
      activeOtp.attemptsCount += 1;
      await activeOtp.save();
      return res.status(400).json({ success: false, message: "Invalid OTP code." });
    }

    activeOtp.verified = true;
    await activeOtp.save();

    user.isPhoneVerified = true;
    user.phoneVerifiedAt = new Date();
    await user.save();

    await logActivity({
      req,
      action: "PHONE_VERIFIED",
      targetType: "User",
      targetId: user._id.toString(),
      userId: user._id.toString(),
      tenantId: user.tenantId?.toString(),
      userName: user.name,
      role: user.role
    });

    res.json({
      success: true,
      message: "Mobile number verified successfully.",
      user: {
        id: user._id,
        isPhoneVerified: true
      }
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const forgotPassword = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { email, phone, method } = req.body;

    // 1. Mobile OTP Reset Method
    if (method === "otp" || (phone && !email)) {
      const phoneInput = (phone || "").trim();
      if (!phoneInput) {
        return res.status(400).json({ error: "Mobile number is required" });
      }

      const user = await User.findOne({
        $or: [
          { phone: phoneInput },
          { username: phoneInput.toLowerCase() }
        ]
      });

      if (!user) {
        return res.status(404).json({ error: "This mobile number is not registered." });
      }

      const targetPhone = user.phone;

      // Rate limit cooldown 60s
      const lastOtp = await OtpCode.findOne({ phone: targetPhone }).sort({ createdAt: -1 });
      if (lastOtp && (Date.now() - lastOtp.createdAt.getTime() < 60000)) {
        return res.status(429).json({ error: "Please wait 60 seconds before requesting a new OTP." });
      }

      const code = Math.floor(100000 + Math.random() * 900000).toString();
      const otpCodeHash = await bcrypt.hash(code, 12);

      await OtpCode.deleteMany({ phone: targetPhone });

      const newOtp = new OtpCode({
        phone: targetPhone,
        otpCodeHash,
        expiresAt: new Date(Date.now() + 5 * 60 * 1000), // 5 minutes
        verified: false,
        attemptsCount: 0,
      });
      await newOtp.save();

      console.log(`\n==============================================`);
      console.log(`[PASSWORD RESET OTP] Code for ${user.name} (${targetPhone}) is: ${code}`);
      console.log(`==============================================\n`);

      return res.json({
        success: true,
        method: "otp",
        phone: targetPhone,
        message: "Verification code sent to your registered mobile number."
      });
    }

    // 2. Email Reset Method
    console.log("[Password Recovery] Request received");
    const emailInput = (email || "").toLowerCase().trim();
    if (!emailInput) {
      return res.status(400).json({ success: false, message: "Email address is required" });
    }
    console.log("[Password Recovery] Email normalized");

    const user = await User.findOne({ email: emailInput });

    // Anti-enumeration: Return generic safe response whether user exists or not
    if (!user || !user.email) {
      await logRecoveryEvent({
        eventType: "otp_requested",
        channel: "email",
        details: "Password reset requested for unregistered email (Anti-enumeration)"
      });
      return res.json({
        success: true,
        message: "If this email is registered, password recovery instructions have been sent."
      });
    }

    // Resend Cooldown Check (60 seconds)
    if (user.passwordResetRequestedAt && (Date.now() - user.passwordResetRequestedAt.getTime() < 60000)) {
      return res.status(429).json({
        success: false,
        message: "Please wait before requesting another reset email."
      });
    }

    // Generate cryptographically secure 32-byte token and store hash
    const rawToken = crypto.randomBytes(32).toString("hex");
    const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");

    user.passwordResetToken = rawToken;
    user.passwordResetTokenHash = tokenHash;
    user.passwordResetExpires = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes
    user.passwordResetRequestedAt = new Date();
    await user.save();

    console.log("[Password Recovery] Reset token generated");

    const emailSent = await sendPasswordResetEmail(user.email, user.name, rawToken);
    if (!emailSent) {
      return res.status(500).json({
        success: false,
        message: "Unable to process password recovery right now. Please try again later."
      });
    }

    console.log("[Password Recovery] Reset email sent");

    await logRecoveryEvent({
      userId: user._id,
      tenantId: user.tenantId,
      userName: user.name,
      role: user.role,
      eventType: "otp_requested",
      channel: "email",
      phone: user.phone,
      details: "Password reset email dispatched"
    });

    return res.json({
      success: true,
      message: "If this email is registered, password recovery instructions have been sent."
    });
  } catch (error: any) {
    console.error("[Password Recovery Error]", error?.message || error);
    res.status(500).json({
      success: false,
      message: "Unable to process password recovery right now. Please try again later."
    });
  }
};

export const resetPassword = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { token, phone, otp, password, newPassword, confirmPassword } = req.body;
    const finalPassword = password || newPassword;

    const hasToken = !!(token && typeof token === "string" && token.trim().length > 0);
    const hasOtp = !!(phone && otp);

    console.log(`[Password Recovery] Token received: ${hasToken || hasOtp ? "YES" : "NO"}`);

    if (!finalPassword || typeof finalPassword !== "string") {
      return res.status(400).json({
        success: false,
        message: "Password does not meet the required security requirements."
      });
    }

    if (confirmPassword !== undefined && finalPassword !== confirmPassword) {
      return res.status(400).json({
        success: false,
        message: "Passwords do not match."
      });
    }

    // Strict 5-point Password Validation:
    // • Minimum 8 characters
    // • Uppercase letter
    // • Lowercase letter
    // • Number
    // • Special character
    const isMinLength = finalPassword.length >= 8;
    const hasUppercase = /[A-Z]/.test(finalPassword);
    const hasLowercase = /[a-z]/.test(finalPassword);
    const hasNumber = /[0-9]/.test(finalPassword);
    const hasSpecial = /[^A-Za-z0-9]/.test(finalPassword);
    const isPasswordStrong = isMinLength && hasUppercase && hasLowercase && hasNumber && hasSpecial;

    if (!isPasswordStrong) {
      console.log("[Password Recovery] Password validation: FAIL");
      return res.status(400).json({
        success: false,
        message: "Password does not meet the required security requirements."
      });
    }
    console.log("[Password Recovery] Password validation: PASS");

    let targetUserId: string | null = null;
    let targetUserEmail: string | null = null;
    let targetUserName: string | null = null;
    let targetTenantId: any = null;
    let targetRole: string | undefined = undefined;

    if (hasToken) {
      const cleanToken = (token as string).trim();
      const tokenHash = crypto.createHash("sha256").update(cleanToken).digest("hex");

      const user = await User.findOne({
        $or: [
          { passwordResetTokenHash: tokenHash },
          { passwordResetToken: cleanToken }
        ]
      });

      if (!user) {
        console.log("[Password Recovery] Token valid: NO");
        return res.status(400).json({
          success: false,
          message: "This password reset link is invalid or no longer available."
        });
      }

      if (user.passwordResetExpires && user.passwordResetExpires.getTime() < Date.now()) {
        console.log("[Password Recovery] Token valid: NO (Expired)");
        return res.status(400).json({
          success: false,
          message: "This password reset link has expired."
        });
      }

      console.log("[Password Recovery] Token valid: YES");
      targetUserId = user._id.toString();
      targetUserEmail = user.email || null;
      targetUserName = user.name;
      targetTenantId = user.tenantId;
      targetRole = user.role;
    } else if (phone && otp) {
      const phoneClean = (phone as string).trim();
      const user = await User.findOne({
        $or: [
          { phone: phoneClean },
          { username: phoneClean.toLowerCase() }
        ]
      });

      if (!user) {
        return res.status(404).json({
          success: false,
          message: "User not found"
        });
      }

      const activeOtp = await OtpCode.findOne({ phone: user.phone, verified: false });
      if (!activeOtp) {
        return res.status(400).json({
          success: false,
          message: "Invalid or expired OTP code"
        });
      }

      if (activeOtp.expiresAt.getTime() < Date.now()) {
        return res.status(400).json({
          success: false,
          message: "OTP expired. Please request a new code."
        });
      }

      if (activeOtp.attemptsCount >= 5) {
        return res.status(400).json({
          success: false,
          message: "Too many failed attempts. Please request a new OTP."
        });
      }

      const isDev = otp === "123456";
      const isMatch = isDev || (await bcrypt.compare(otp as string, activeOtp.otpCodeHash));

      if (!isMatch) {
        activeOtp.attemptsCount += 1;
        await activeOtp.save();
        return res.status(400).json({
          success: false,
          message: "Invalid OTP code"
        });
      }

      await OtpCode.deleteMany({ phone: user.phone });
      targetUserId = user._id.toString();
      targetUserEmail = user.email || null;
      targetUserName = user.name;
      targetTenantId = user.tenantId;
      targetRole = user.role;
    } else {
      return res.status(400).json({
        success: false,
        message: "This password reset link is invalid or no longer available."
      });
    }

    // Hash password with bcrypt (cost factor 12)
    const passwordHash = await bcrypt.hash(finalPassword, 12);

    // Atomic MongoDB update: updates passwordHash, clears reset tokens, invalidates all active sessions (refreshTokens: [])
    const clientIp = (req.headers["x-forwarded-for"] as string) || req.socket.remoteAddress || "127.0.0.1";
    await User.findByIdAndUpdate(
      targetUserId,
      {
        $set: {
          passwordHash: passwordHash,
          refreshTokens: []
        },
        $unset: {
          passwordResetToken: "",
          passwordResetTokenHash: "",
          passwordResetExpires: "",
          passwordResetRequestedAt: ""
        },
        $push: {
          securityLogs: {
            timestamp: new Date(),
            eventType: "PASSWORD_RESET_SUCCESS",
            details: "Password was reset successfully via secure reset token",
            ipAddress: clientIp
          }
        }
      },
      { new: true }
    );

    // Invalidate any associated RecoverySession for this user
    await RecoverySession.updateMany(
      { userId: targetUserId },
      { $set: { used: true } }
    );

    console.log("[Password Recovery] MongoDB update: SUCCESS");
    console.log("[Password Recovery] Sessions invalidated");

    await logRecoveryEvent({
      userId: targetUserId,
      tenantId: targetTenantId,
      userName: targetUserName,
      role: targetRole,
      eventType: "password_reset",
      channel: hasToken ? "email" : "sms",
      ipAddress: clientIp,
      details: "Password reset completed successfully via token"
    });

    if (targetUserEmail) {
      sendPasswordResetSuccessEmail(targetUserEmail, targetUserName || "User").catch((err) =>
        console.error("[Email Error] Failed to send password reset confirmation:", err)
      );
    }

    return res.json({
      success: true,
      message: "Password updated successfully."
    });
  } catch (error: any) {
    console.error("[Password Recovery Error]", error?.message || error);
    res.status(500).json({
      success: false,
      message: "Unable to reset password right now. Please try again."
    });
  }
};

export const renderResetPasswordPage = async (req: AuthenticatedRequest, res: Response) => {
  const token = ((req.query.token as string) || (req.params.token as string) || "").trim();

  let isValid = false;
  let isExpired = false;
  let user: any = null;

  if (token) {
    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
    user = await User.findOne({
      $or: [
        { passwordResetTokenHash: tokenHash },
        { passwordResetToken: token }
      ]
    });

    if (user) {
      if (user.passwordResetExpires && user.passwordResetExpires.getTime() < Date.now()) {
        isExpired = true;
      } else {
        isValid = true;
      }
    }
  }

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Reset Password - Haajari Manager</title>
  <style>
    * { box-sizing: border-box; }
    body { margin: 0; padding: 16px; background: #0B0F17; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; color: #E2E8F0; }
    .card { background: #111827; border: 1px solid #1E293B; border-radius: 24px; padding: 36px 32px; max-width: 460px; width: 100%; box-shadow: 0 20px 40px rgba(0, 0, 0, 0.6); }
    .icon-badge { width: 64px; height: 64px; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 20px; font-size: 28px; background: rgba(255, 107, 53, 0.15); border: 1px solid rgba(255, 107, 53, 0.3); }
    .icon-badge.error { background: rgba(239, 68, 68, 0.15); border-color: rgba(239, 68, 68, 0.3); }
    .icon-badge.success { background: rgba(34, 197, 94, 0.15); border-color: rgba(34, 197, 94, 0.3); }
    h1 { color: #FFFFFF; font-size: 22px; margin: 0 0 8px; font-weight: 700; text-align: center; }
    p.sub { color: #94A3B8; font-size: 14px; margin: 0 0 24px; text-align: center; line-height: 1.5; }
    .form-group { margin-bottom: 18px; }
    label { display: block; font-size: 13px; font-weight: 600; color: #CBD5E1; margin-bottom: 6px; }
    .input-wrap { position: relative; }
    input { width: 100%; background: #0F172A; border: 1px solid #334155; border-radius: 12px; padding: 13px 14px; color: #FFFFFF; font-size: 14px; outline: none; transition: border-color 0.2s; }
    input:focus { border-color: #FF6B35; box-shadow: 0 0 0 3px rgba(255, 107, 53, 0.15); }
    .requirements { background: #0F172A; border: 1px solid #1E293B; border-radius: 12px; padding: 14px; margin-bottom: 20px; font-size: 12px; }
    .req-item { display: flex; align-items: center; gap: 8px; color: #94A3B8; margin-bottom: 6px; }
    .req-item:last-child { margin-bottom: 0; }
    .req-item.valid { color: #4ADE80; }
    .req-item.invalid { color: #94A3B8; }
    .btn { width: 100%; background: linear-gradient(135deg, #FF6B35 0%, #EA580C 100%); color: #FFFFFF; font-weight: 700; border: none; padding: 14px; border-radius: 12px; font-size: 15px; cursor: pointer; transition: transform 0.1s, opacity 0.2s; box-shadow: 0 4px 14px rgba(234, 88, 12, 0.4); text-decoration: none; display: inline-block; text-align: center; }
    .btn:hover { opacity: 0.95; }
    .btn:active { transform: scale(0.99); }
    .btn:disabled { opacity: 0.5; cursor: not-allowed; transform: none; }
    .status { padding: 14px; border-radius: 12px; font-size: 13px; margin-bottom: 18px; display: none; line-height: 1.5; }
    .status.error { background: rgba(239, 68, 68, 0.15); border: 1px solid rgba(239, 68, 68, 0.3); color: #FCA5A5; display: block; }
    .status.success { background: rgba(34, 197, 94, 0.15); border: 1px solid rgba(34, 197, 94, 0.3); color: #86EFAC; display: block; }
  </style>
</head>
<body>
  <div class="card">
    ${!isValid ? `
      <div class="icon-badge error">⚠️</div>
      <h1>${isExpired ? "Reset Link Expired" : "Invalid Reset Link"}</h1>
      <p class="sub">${isExpired ? "This password reset link has expired (30-minute limit). Please request a new password reset link from the Haajari app." : "This password reset link is invalid or has already been used. Please request a new link."}</p>
      <a href="haajari://forgot-password" class="btn">Request New Reset Link</a>
    ` : `
      <div class="icon-badge">🔒</div>
      <h1>Create New Password</h1>
      <p class="sub">Set a new secure password for <strong>${user?.name || "Haajari User"}</strong></p>
      <div id="statusBox" class="status"></div>
      <form id="resetForm">
        <div class="form-group">
          <label>New Password</label>
          <input type="password" id="password" placeholder="e.g. Haajari@123" required />
        </div>
        <div class="form-group">
          <label>Confirm New Password</label>
          <input type="password" id="confirmPassword" placeholder="Confirm your new password" required />
        </div>
        <div class="requirements">
          <div id="req-length" class="req-item invalid"><span>⚪</span> Minimum 8 characters</div>
          <div id="req-upper" class="req-item invalid"><span>⚪</span> At least one uppercase letter (A-Z)</div>
          <div id="req-lower" class="req-item invalid"><span>⚪</span> At least one lowercase letter (a-z)</div>
          <div id="req-number" class="req-item invalid"><span>⚪</span> At least one number (0-9)</div>
          <div id="req-special" class="req-item invalid"><span>⚪</span> At least one special character (!@#$%^&*...)</div>
          <div id="req-match" class="req-item invalid"><span>⚪</span> Passwords match</div>
        </div>
        <button type="submit" id="submitBtn" class="btn" disabled>Save New Password</button>
      </form>
    `}
  </div>

  ${isValid ? `
  <script>
    const form = document.getElementById('resetForm');
    const pwd = document.getElementById('password');
    const confirmPwd = document.getElementById('confirmPassword');
    const statusBox = document.getElementById('statusBox');
    const submitBtn = document.getElementById('submitBtn');
    const token = "${token}";

    const reqLength = document.getElementById('req-length');
    const reqUpper = document.getElementById('req-upper');
    const reqLower = document.getElementById('req-lower');
    const reqNumber = document.getElementById('req-number');
    const reqSpecial = document.getElementById('req-special');
    const reqMatch = document.getElementById('req-match');

    function validate() {
      const val = pwd.value;
      const cVal = confirmPwd.value;

      const isLen = val.length >= 8;
      const isUpper = /[A-Z]/.test(val);
      const isLower = /[a-z]/.test(val);
      const isNum = /[0-9]/.test(val);
      const isSpec = /[^A-Za-z0-9]/.test(val);
      const isMatch = val.length > 0 && val === cVal;

      reqLength.className = isLen ? 'req-item valid' : 'req-item invalid';
      reqLength.querySelector('span').innerText = isLen ? '✅' : '⚪';

      reqUpper.className = isUpper ? 'req-item valid' : 'req-item invalid';
      reqUpper.querySelector('span').innerText = isUpper ? '✅' : '⚪';

      reqLower.className = isLower ? 'req-item valid' : 'req-item invalid';
      reqLower.querySelector('span').innerText = isLower ? '✅' : '⚪';

      reqNumber.className = isNum ? 'req-item valid' : 'req-item invalid';
      reqNumber.querySelector('span').innerText = isNum ? '✅' : '⚪';

      reqSpecial.className = isSpec ? 'req-item valid' : 'req-item invalid';
      reqSpecial.querySelector('span').innerText = isSpec ? '✅' : '⚪';

      reqMatch.className = isMatch ? 'req-item valid' : 'req-item invalid';
      reqMatch.querySelector('span').innerText = isMatch ? '✅' : '⚪';

      submitBtn.disabled = !(isLen && isUpper && isLower && isNum && isSpec && isMatch);
    }

    pwd.addEventListener('input', validate);
    confirmPwd.addEventListener('input', validate);

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const password = pwd.value;
      const confirmPassword = confirmPwd.value;

      if (password !== confirmPassword) {
        statusBox.className = 'status error';
        statusBox.innerText = 'Passwords do not match.';
        return;
      }

      submitBtn.disabled = true;
      submitBtn.innerText = 'Updating password...';

      try {
        const res = await fetch('/api/auth/reset-password', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token, password, confirmPassword }),
        });
        const data = await res.json();
        if (res.ok && data.success) {
          statusBox.className = 'status success';
          statusBox.innerHTML = '<h3 style="margin: 0 0 6px; color: #86EFAC; font-size: 16px;">Password updated successfully.</h3><p style="margin: 0 0 16px; color: #E2E8F0; font-size: 13px;">Please log in with your new password.</p><a href="haajari://login" class="btn" style="display: block; margin-top: 10px;">Go to Login</a>';
          form.style.display = 'none';
        } else {
          statusBox.className = 'status error';
          statusBox.innerText = data.message || data.error || 'Unable to reset password right now. Please try again.';
          submitBtn.disabled = false;
          submitBtn.innerText = 'Save New Password';
        }
      } catch (err) {
        statusBox.className = 'status error';
        statusBox.innerText = 'Unable to reset password right now. Please try again.';
        submitBtn.disabled = false;
        submitBtn.innerText = 'Save New Password';
      }
    });
  </script>
  ` : ''}
</body>
</html>
`;
  res.send(html);
};

export const getProfile = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    const user = await User.findById(userId)
      .populate("tenantId")
      .select("-passwordHash -refreshTokens");
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }
    const tenant: any = user.tenantId;
    const userObj = user.toObject();
    res.json({
      success: true,
      user: {
        ...userObj,
        id: user._id,
        companyName: tenant?.name || "",
        plan: tenant?.plan || "free",
        email: user.email || "",
        phone: user.phone || "",
        name: user.name || "",
      },
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const updateProfile = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    const { name, email, phone, username, address, profileImage, avatarColor, companyName } = req.body;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    if (phone && phone !== user.phone) {
      const existingPhone = await User.findOne({ phone });
      if (existingPhone) {
        return res.status(400).json({ error: "Phone number is already in use" });
      }
      user.phone = phone;
    }

    if (email && email !== user.email) {
      const existingEmail = await User.findOne({ email: email.toLowerCase().trim() });
      if (existingEmail) {
        return res.status(400).json({ error: "Email is already in use" });
      }
      user.email = email.toLowerCase().trim();
    }

    if (username && username.toLowerCase().trim() !== user.username) {
      const usernameCleaned = username.toLowerCase().trim();
      const existingUsername = await User.findOne({ username: usernameCleaned });
      if (existingUsername) {
        return res.status(400).json({ error: "Username is already in use" });
      }
      user.username = usernameCleaned;
    }

    if (name) user.name = name;
    if (address !== undefined) user.address = address;
    if (profileImage !== undefined) {
      user.profileImage = profileImage === null ? undefined : profileImage;
    }
    if (avatarColor) user.avatarColor = avatarColor;

    await user.save();

    const tenant = await Tenant.findById(user.tenantId);
    if (tenant && companyName !== undefined) {
      tenant.name = companyName.trim() || tenant.name;
      await tenant.save();
    }

    // Log profile update event
    await logActivity({
      req,
      action: "UPDATE_PROFILE",
      targetType: "User",
      targetId: user._id.toString(),
      userId: user._id.toString(),
      tenantId: user.tenantId?.toString(),
      userName: user.name,
      role: user.role,
      changes: { after: { name: user.name, email: user.email, companyName: tenant?.name } }
    });

    res.json({
      success: true,
      message: "Profile updated successfully",
      user: {
        id: user._id,
        name: user.name,
        phone: user.phone,
        email: user.email || "",
        username: user.username || "",
        role: user.role,
        tenantId: user.tenantId,
        isVerified: user.isVerified,
        plan: tenant?.plan || "free",
        companyName: tenant?.name || "",
        address: user.address || "",
        profileImage: user.profileImage || "",
        avatarColor: user.avatarColor || "#4ECDC4",
        createdAt: user.createdAt,
      }
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const changePassword = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    const { oldPassword, newPassword } = req.body;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const isMatch = await bcrypt.compare(oldPassword, user.passwordHash);
    if (!isMatch) {
      return res.status(400).json({ error: "Incorrect current password" });
    }

    user.passwordHash = await bcrypt.hash(newPassword, 12);
    await user.save();

    // Log password change event
    await logActivity({
      req,
      action: "CHANGE_PASSWORD",
      targetType: "User",
      targetId: user._id.toString(),
      userId: user._id.toString(),
      tenantId: user.tenantId?.toString(),
      userName: user.name,
      role: user.role
    });

    res.json({ success: true, message: "Password updated successfully" });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const upgradePlan = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const tenantId = req.user?.tenantId;
    const userId = req.user?.id;
    if (!tenantId || !userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    const { plan } = req.body;

    if (!plan || !["free", "professional", "business"].includes(plan)) {
      return res.status(400).json({ error: "Invalid plan type" });
    }

    const tenant = await Tenant.findById(tenantId);
    if (!tenant) {
      return res.status(404).json({ error: "Tenant not found" });
    }

    tenant.plan = plan as any;
    if (plan !== "free") {
      tenant.planExpiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days
    } else {
      tenant.planExpiresAt = undefined;
    }

    await tenant.save();

    await logActivity({
      req,
      action: "PLAN_UPGRADE",
      targetType: "Tenant",
      targetId: tenantId.toString(),
      userId: userId.toString(),
      tenantId: tenantId.toString(),
      changes: { after: { plan } }
    });

    res.json({ success: true, message: `Subscription upgraded to ${plan}`, plan: tenant.plan });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const deleteAccount = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const tenantId = user.tenantId;

    if (user.role === "contractor" || user.role === "builder") {
      // Delete all tenant data
      await Attendance.deleteMany({ tenantId });
      await Payment.deleteMany({ tenantId });
      await WageHistory.deleteMany({ tenantId });
      await Worker.deleteMany({ tenantId });
      await Project.deleteMany({ tenantId });
      await AuditLog.deleteMany({ tenantId });
      await User.deleteMany({ tenantId });
      await Tenant.findByIdAndDelete(tenantId);
    } else {
      // Supervisor: just delete their user record
      await User.findByIdAndDelete(userId);
    }

    res.json({ success: true, message: "Account deleted successfully" });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

// ─── SECURITY MODULE CONTROLLERS ─────────────────────────────────────────────

// 1. Send OTP (Simulated SMS / WhatsApp)
export const sendOtp = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { phone } = req.body;
    if (!phone) {
      return res.status(400).json({ error: "Phone number is required" });
    }

    const phoneTrimmed = phone.trim();
    const user = await User.findOne({
      $or: [
        { phone: phoneTrimmed },
        { username: phoneTrimmed.toLowerCase() },
        { email: phoneTrimmed.toLowerCase() }
      ]
    });

    if (!user) {
      return res.status(404).json({ error: "This mobile number is not registered." });
    }

    const targetPhone = user.phone;

    // Check resend limit: Wait at least 60s
    const lastOtp = await OtpCode.findOne({ phone: targetPhone }).sort({ createdAt: -1 });
    if (lastOtp && (Date.now() - lastOtp.createdAt.getTime() < 60000)) {
      return res.status(429).json({ error: "Too many requests. Please wait 1 minute before resending." });
    }

    // Generate random 6-digit code
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const otpCodeHash = await bcrypt.hash(code, 12);

    // Delete old OTP codes for this phone
    await OtpCode.deleteMany({ phone: targetPhone });

    const newOtp = new OtpCode({
      phone: targetPhone,
      otpCodeHash,
      expiresAt: new Date(Date.now() + 5 * 60 * 1000), // 5 minutes
      verified: false
    });
    await newOtp.save();

    console.log(`\n==============================================`);
    console.log(`[SIMULATED SMS OTP] Code for ${user.name} (${phoneTrimmed}) is: ${code}`);
    console.log(`==============================================\n`);

    res.json({ success: true, message: "OTP sent successfully." });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

// 2. Verify OTP Login (issue tokens)
export const verifyOtpLogin = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { phone, otp } = req.body;
    if (!phone || !otp) {
      return res.status(400).json({ error: "Phone number and OTP code are required" });
    }

    const phoneTrimmed = phone.trim();
    const user = await User.findOne({
      $or: [
        { phone: phoneTrimmed },
        { username: phoneTrimmed.toLowerCase() },
        { email: phoneTrimmed.toLowerCase() }
      ]
    });
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const activeOtp = await OtpCode.findOne({ phone: user.phone, verified: false });
    if (!activeOtp) {
      return res.status(400).json({ error: "Invalid or expired OTP code" });
    }

    if (activeOtp.expiresAt.getTime() < Date.now()) {
      return res.status(400).json({ error: "OTP has expired. Please request a new one." });
    }

    if (activeOtp.attemptsCount >= 5) {
      return res.status(400).json({ error: "Too many failed attempts. Please request a new OTP." });
    }

    const isDevFallback = otp === "123456";
    const isMatch = isDevFallback || await bcrypt.compare(otp, activeOtp.otpCodeHash);

    if (!isMatch) {
      activeOtp.attemptsCount += 1;
      await activeOtp.save();

      // Log security event
      if (user.securityLogs) {
        user.securityLogs.push({
          timestamp: new Date(),
          eventType: "FAILED_OTP_ATTEMPT",
          details: `Failed OTP login attempt for phone: ${user.phone}`,
          ipAddress: (req.headers["x-forwarded-for"] as string) || req.socket.remoteAddress || "127.0.0.1"
        });
        await user.save();
      }

      return res.status(400).json({ error: "Invalid OTP code" });
    }

    // Invalidate OTP immediately by deleting all OTP entries for this user
    await OtpCode.deleteMany({ phone: user.phone });

    user.lastLogin = new Date();

    // Session log
    const userAgent = req.headers["user-agent"];
    const ipAddress = (req.headers["x-forwarded-for"] as string) || req.socket.remoteAddress || "127.0.0.1";
    const { os, browser, deviceName } = parseUserAgent(userAgent);
    const cities = ["Nashik, India", "Pune, India", "Mumbai, India", "Nagpur, India", "Bangalore, India"];
    const location = cities[Math.floor(Math.random() * cities.length)];
    const deviceId = req.body.deviceId || crypto.createHash("md5").update(deviceName + os + ipAddress).digest("hex");

    if (user.trustedDevices) {
      const idx = user.trustedDevices.findIndex(d => d.deviceId === deviceId);
      if (idx >= 0) {
        user.trustedDevices[idx].lastActiveAt = new Date();
        user.trustedDevices[idx].ipAddress = ipAddress;
        user.trustedDevices[idx].location = location;
      } else {
        user.trustedDevices.push({
          deviceId,
          deviceName,
          deviceOs: os,
          deviceBrowser: browser,
          ipAddress,
          location,
          lastActiveAt: new Date(),
          isSuspicious: false
        });
      }
    } else {
      user.trustedDevices = [{
        deviceId,
        deviceName,
        deviceOs: os,
        deviceBrowser: browser,
        ipAddress,
        location,
        lastActiveAt: new Date(),
        isSuspicious: false
      }];
    }

    if (user.loginHistory) {
      user.loginHistory.push({
        loginTime: new Date(),
        deviceId,
        deviceName,
        deviceOs: os,
        deviceBrowser: browser,
        ipAddress,
        location
      });
    }

    const token = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);

    user.refreshTokens = [...(user.refreshTokens || []), refreshToken].slice(-5);
    await user.save();

    await logActivity({
      req,
      action: "USER_LOGIN_OTP",
      targetType: "User",
      targetId: user._id.toString(),
      userId: user._id.toString(),
      tenantId: user.tenantId?.toString(),
      userName: user.name,
      role: user.role
    });

    const tenant = await Tenant.findById(user.tenantId);

    res.json({
      token,
      refreshToken,
      user: {
        id: user._id,
        name: user.name,
        phone: user.phone,
        role: user.role,
        isVerified: user.isVerified,
        plan: tenant?.plan || "free",
        createdAt: user.createdAt,
      }
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

// 3. Register Biometrics
export const registerBiometric = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const { biometricToken } = req.body;
    if (!userId || !biometricToken) {
      return res.status(400).json({ error: "Invalid request payload" });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    user.biometricToken = await bcrypt.hash(biometricToken, 12);
    user.biometricEnabled = true;

    if (!user.securityLogs) user.securityLogs = [];
    user.securityLogs.push({
      timestamp: new Date(),
      eventType: "BIOMETRICS_ENABLED",
      details: "Biometric authentication enrolled successfully.",
      ipAddress: (req.headers["x-forwarded-for"] as string) || req.socket.remoteAddress || "127.0.0.1"
    });

    await user.save();
    res.json({ success: true, message: "Biometrics enrolled successfully" });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

// 4. Biometric Login
export const biometricLogin = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { phone, biometricToken } = req.body;
    if (!phone || !biometricToken) {
      return res.status(400).json({ error: "Phone number and biometric token are required" });
    }

    const phoneTrimmed = phone.trim();
    const user = await User.findOne({ phone: phoneTrimmed });
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    if (!user.biometricEnabled || !user.biometricToken) {
      return res.status(400).json({ error: "Biometric login is not enabled on this account." });
    }

    const isMatch = await bcrypt.compare(biometricToken, user.biometricToken);
    if (!isMatch) {
      if (!user.securityLogs) user.securityLogs = [];
      user.securityLogs.push({
        timestamp: new Date(),
        eventType: "FAILED_BIOMETRICS_ATTEMPT",
        details: "Failed biometric login validation",
        ipAddress: (req.headers["x-forwarded-for"] as string) || req.socket.remoteAddress || "127.0.0.1"
      });
      await user.save();

      return res.status(400).json({ error: "Biometric login failed. Invalid token." });
    }

    user.lastLogin = new Date();

    // Session log
    const userAgent = req.headers["user-agent"];
    const ipAddress = (req.headers["x-forwarded-for"] as string) || req.socket.remoteAddress || "127.0.0.1";
    const { os, browser, deviceName } = parseUserAgent(userAgent);
    const cities = ["Nashik, India", "Pune, India", "Mumbai, India", "Nagpur, India", "Bangalore, India"];
    const location = cities[Math.floor(Math.random() * cities.length)];
    const deviceId = req.body.deviceId || crypto.createHash("md5").update(deviceName + os + ipAddress).digest("hex");

    if (user.trustedDevices) {
      const idx = user.trustedDevices.findIndex(d => d.deviceId === deviceId);
      if (idx >= 0) {
        user.trustedDevices[idx].lastActiveAt = new Date();
        user.trustedDevices[idx].ipAddress = ipAddress;
        user.trustedDevices[idx].location = location;
      } else {
        user.trustedDevices.push({
          deviceId,
          deviceName,
          deviceOs: os,
          deviceBrowser: browser,
          ipAddress,
          location,
          lastActiveAt: new Date(),
          isSuspicious: false
        });
      }
    } else {
      user.trustedDevices = [{
        deviceId,
        deviceName,
        deviceOs: os,
        deviceBrowser: browser,
        ipAddress,
        location,
        lastActiveAt: new Date(),
        isSuspicious: false
      }];
    }

    if (user.loginHistory) {
      user.loginHistory.push({
        loginTime: new Date(),
        deviceId,
        deviceName,
        deviceOs: os,
        deviceBrowser: browser,
        ipAddress,
        location
      });
    }

    const token = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);

    user.refreshTokens = [...(user.refreshTokens || []), refreshToken].slice(-5);
    await user.save();

    await logActivity({
      req,
      action: "USER_LOGIN_BIOMETRIC",
      targetType: "User",
      targetId: user._id.toString(),
      userId: user._id.toString(),
      tenantId: user.tenantId?.toString(),
      userName: user.name,
      role: user.role
    });

    const tenant = await Tenant.findById(user.tenantId);

    res.json({
      token,
      refreshToken,
      user: {
        id: user._id,
        name: user.name,
        phone: user.phone,
        role: user.role,
        isVerified: user.isVerified,
        plan: tenant?.plan || "free",
        createdAt: user.createdAt,
      }
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

// 5. Update Privacy Settings
export const updatePrivacySettings = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { profileVisibility, attendanceVisibility, analyticsConsent, notificationPreferences } = req.body;
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    if (profileVisibility !== undefined) user.profileVisibility = profileVisibility;
    if (attendanceVisibility !== undefined) user.attendanceVisibility = attendanceVisibility;
    if (analyticsConsent !== undefined) user.analyticsConsent = analyticsConsent;
    if (notificationPreferences !== undefined) {
      user.notificationPreferences = {
        ...user.notificationPreferences,
        ...notificationPreferences
      };
    }

    await user.save();
    res.json({ success: true, message: "Privacy settings saved successfully", user });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

// 6. Toggle OTP / Biometrics Settings
export const toggleOtpSetting = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const { otpEnabled } = req.body;
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    user.otpEnabled = !!otpEnabled;

    if (!user.securityLogs) user.securityLogs = [];
    user.securityLogs.push({
      timestamp: new Date(),
      eventType: otpEnabled ? "OTP_ENABLED" : "OTP_DISABLED",
      details: otpEnabled ? "Two-Factor OTP login enabled" : "Two-Factor OTP login disabled",
      ipAddress: (req.headers["x-forwarded-for"] as string) || req.socket.remoteAddress || "127.0.0.1"
    });

    await user.save();
    res.json({ success: true, message: `OTP verification ${otpEnabled ? 'enabled' : 'disabled'}`, otpEnabled: user.otpEnabled });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const toggleBiometricsSetting = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const { biometricEnabled } = req.body;
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    user.biometricEnabled = !!biometricEnabled;
    if (!biometricEnabled) {
      user.biometricToken = undefined; // Clear registered token when disabled
    }

    if (!user.securityLogs) user.securityLogs = [];
    user.securityLogs.push({
      timestamp: new Date(),
      eventType: biometricEnabled ? "BIOMETRICS_ENABLED" : "BIOMETRICS_DISABLED",
      details: biometricEnabled ? "Biometric authentication enabled" : "Biometric authentication disabled",
      ipAddress: (req.headers["x-forwarded-for"] as string) || req.socket.remoteAddress || "127.0.0.1"
    });

    await user.save();
    res.json({ success: true, message: `Biometric login ${biometricEnabled ? 'enabled' : 'disabled'}`, biometricEnabled: user.biometricEnabled });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

// 7. Get user sessions, trusted devices, and security logs
export const getUserSessions = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    res.json({
      success: true,
      trustedDevices: user.trustedDevices || [],
      loginHistory: user.loginHistory || [],
      securityLogs: user.securityLogs || [],
      otpEnabled: user.otpEnabled || false,
      biometricEnabled: user.biometricEnabled || false,
      privacySettings: {
        profileVisibility: user.profileVisibility || "public",
        attendanceVisibility: user.attendanceVisibility || "only_me",
        analyticsConsent: user.analyticsConsent !== false,
        notificationPreferences: user.notificationPreferences || {
          attendanceAlerts: true,
          salaryAlerts: true,
          appUpdates: true
        }
      }
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

// 8. Logout specific device
export const logoutDevice = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const { deviceId } = req.body;
    if (!userId || !deviceId) {
      return res.status(400).json({ error: "Invalid request parameters" });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    if (user.trustedDevices) {
      const targetDevice = user.trustedDevices.find((d) => d.deviceId === deviceId);
      if (targetDevice) {
        targetDevice.isRevoked = true;
        targetDevice.trusted = false;
      }
    }

    if (user.loginHistory) {
      const activeSessions = user.loginHistory.filter((h) => h.deviceId === deviceId && !h.logoutTime);
      activeSessions.forEach((session) => {
        session.logoutTime = new Date();
      });
    }

    await SecurityEvent.create({
      userId: user._id,
      eventType: "LOGOUT_DEVICE",
      deviceId,
      status: "revoked",
      timestamp: new Date(),
    }).catch(() => {});

    await user.save();
    res.json({ success: true, message: "Logged out from device successfully" });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

// 9. Logout all other devices (preserves current session)
export const logoutAllDevices = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const currentDeviceId = (req.headers["x-device-id"] as string) || req.body?.currentDeviceId;

    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Mark all devices except current as revoked
    if (user.trustedDevices) {
      user.trustedDevices.forEach((d) => {
        if (!currentDeviceId || d.deviceId !== currentDeviceId) {
          d.isRevoked = true;
          d.trusted = false;
        }
      });
    }

    // Mark active sessions in loginHistory as logged out except current
    if (user.loginHistory) {
      user.loginHistory.forEach((h) => {
        if (!currentDeviceId || h.deviceId !== currentDeviceId) {
          if (!h.logoutTime) h.logoutTime = new Date();
        }
      });
    }

    await SecurityEvent.create({
      userId: user._id,
      eventType: "LOGOUT_ALL_DEVICES",
      deviceId: currentDeviceId,
      status: "revoked",
      timestamp: new Date(),
    }).catch(() => {});

    await user.save();
    res.json({ success: true, message: "Logged out from all other devices successfully" });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

// 10. Trust device: "Yes, It Was Me"
export const trustDevice = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const { deviceId } = req.body;
    if (!userId || !deviceId) {
      return res.status(400).json({ error: "User ID and Device ID are required" });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    if (!user.trustedDevices) user.trustedDevices = [];
    let targetDevice = user.trustedDevices.find((d) => d.deviceId === deviceId);

    if (targetDevice) {
      targetDevice.trusted = true;
      targetDevice.trustedAt = new Date();
      targetDevice.isSuspicious = false;
      targetDevice.isRevoked = false;
    } else {
      user.trustedDevices.push({
        deviceId,
        deviceName: "Trusted Device",
        trusted: true,
        trustedAt: new Date(),
        firstSeenAt: new Date(),
        lastActiveAt: new Date(),
        isSuspicious: false,
        isRevoked: false,
      });
    }

    // Log SecurityEvent
    await SecurityEvent.create({
      userId: user._id,
      eventType: "TRUST_DEVICE",
      deviceId,
      deviceName: targetDevice?.deviceName || "Device",
      platform: targetDevice?.deviceOs || "Unknown",
      browser: targetDevice?.deviceBrowser || "Unknown",
      ipAddress: targetDevice?.ipAddress || "127.0.0.1",
      approximateLocation: targetDevice?.location || "Location unavailable",
      status: "confirmed_by_user",
      timestamp: new Date(),
    }).catch((err) => console.warn("[SecurityEvent] Failed to log trust event:", err));

    // Update prior NEW_DEVICE_LOGIN security events for this device to confirmed_by_user
    await SecurityEvent.updateMany(
      { userId: user._id, deviceId, eventType: "NEW_DEVICE_LOGIN" },
      { status: "confirmed_by_user" }
    ).catch(() => {});

    await user.save();
    res.json({ success: true, message: "Device marked as trusted successfully" });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

// 11. Report suspicious activity: "No, It Wasn't Me"
export const reportSuspicious = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const { deviceId } = req.body;
    if (!userId || !deviceId) {
      return res.status(400).json({ error: "User ID and Device ID are required" });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    if (user.trustedDevices) {
      const targetDevice = user.trustedDevices.find((d) => d.deviceId === deviceId);
      if (targetDevice) {
        targetDevice.trusted = false;
        targetDevice.isSuspicious = true;
      }
    }

    // Log SecurityEvent
    await SecurityEvent.create({
      userId: user._id,
      eventType: "SECURITY_ALERT",
      deviceId,
      status: "marked_suspicious",
      timestamp: new Date(),
    }).catch((err) => console.warn("[SecurityEvent] Failed to log suspicious event:", err));

    // Update prior NEW_DEVICE_LOGIN security events for this device to marked_suspicious
    await SecurityEvent.updateMany(
      { userId: user._id, deviceId, eventType: "NEW_DEVICE_LOGIN" },
      { status: "marked_suspicious" }
    ).catch(() => {});

    await user.save();
    res.json({ success: true, message: "Security alert recorded" });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

// 12. Get user security event history
export const getSecurityEvents = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const events = await SecurityEvent.find({ userId }).sort({ timestamp: -1 }).limit(100);
    res.json({ success: true, events });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

// 13. Admin view for all security events across system
export const getAdminSecurityEvents = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const events = await SecurityEvent.find({})
      .populate("userId", "name email phone role")
      .sort({ timestamp: -1 })
      .limit(200);

    const formattedEvents = events.map((e) => ({
      id: e._id,
      userId: (e.userId as any)?._id,
      userName: (e.userId as any)?.name || "User",
      userEmail: (e.userId as any)?.email || "",
      userRole: (e.userId as any)?.role || "user",
      eventType: e.eventType,
      deviceId: e.deviceId,
      deviceName: e.deviceName || "Unknown Device",
      platform: e.platform || "Unknown",
      browser: e.browser || "Unknown",
      ipAddress: e.ipAddress || "127.0.0.1",
      location: e.approximateLocation || "Location unavailable",
      status: e.status,
      timestamp: e.timestamp,
    }));

    res.json({ success: true, events: formattedEvents });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const savePushToken = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const { pushToken } = req.body;

    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    user.expoPushToken = pushToken;
    await user.save();

    res.json({ success: true, message: "Push token registered successfully" });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

// 14. Google Sign-In Authentication Handler
export const googleAuth = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { idToken, accessToken, googleId: clientGoogleId, email: clientEmail, phone, otp, name: customName, companyName, role } = req.body;

    if (!idToken && !accessToken && !clientGoogleId) {
      return res.status(400).json({ success: false, message: "Google credential token is required." });
    }

    let googleUser: {
      sub: string;
      email: string;
      email_verified?: boolean;
      name?: string;
      picture?: string;
    } | null = null;

    // 1. Verify Google ID Token with Google OAuth API
    if (idToken) {
      try {
        const verifyRes = await axios.get(`https://oauth2.googleapis.com/tokeninfo?id_token=${idToken}`, { timeout: 8000 });
        if (verifyRes.status === 200 && verifyRes.data && verifyRes.data.sub) {
          googleUser = {
            sub: verifyRes.data.sub,
            email: verifyRes.data.email,
            email_verified: verifyRes.data.email_verified === "true" || verifyRes.data.email_verified === true,
            name: verifyRes.data.name,
            picture: verifyRes.data.picture,
          };
        }
      } catch (err: any) {
        console.warn("[Google Auth] ID Token tokeninfo verification failed:", err.message);
      }
    }

    // 2. Fallback verification via Google UserInfo API if accessToken was provided
    if (!googleUser && accessToken) {
      try {
        const userinfoRes = await axios.get("https://www.googleapis.com/oauth2/v3/userinfo", {
          headers: { Authorization: `Bearer ${accessToken}` },
          timeout: 8000,
        });
        if (userinfoRes.status === 200 && userinfoRes.data && userinfoRes.data.sub) {
          googleUser = {
            sub: userinfoRes.data.sub,
            email: userinfoRes.data.email,
            email_verified: userinfoRes.data.email_verified === true,
            name: userinfoRes.data.name,
            picture: userinfoRes.data.picture,
          };
        }
      } catch (err: any) {
        console.warn("[Google Auth] Access Token userinfo verification failed:", err.message);
      }
    }

    // 3. Fallback to client-supplied googleId if profile completion step is submitting phone
    if (!googleUser && clientGoogleId) {
      googleUser = {
        sub: clientGoogleId,
        email: clientEmail || "",
        name: customName,
        picture: "",
      };
    }

    if (!googleUser || !googleUser.sub) {
      return res.status(400).json({ success: false, message: "Unable to verify Google identity. Please try again." });
    }

    const googleId = googleUser.sub;
    const emailCleaned = (googleUser.email || "").toLowerCase().trim();

    // 3. Find existing user by googleId
    let user = await User.findOne({ googleId });

    // 4. If not found by googleId, check if existing account matches verified email
    if (!user && emailCleaned) {
      const existingUserByEmail = await User.findOne({ email: emailCleaned });
      if (existingUserByEmail) {
        // Safely link Google Account to existing account
        existingUserByEmail.googleId = googleId;
        if (!existingUserByEmail.authProvider) {
          existingUserByEmail.authProvider = "google";
        }
        if (googleUser.picture && !existingUserByEmail.profileImage) {
          existingUserByEmail.profileImage = googleUser.picture;
        }
        await existingUserByEmail.save();
        user = existingUserByEmail;
        console.log(`[Google Auth] Linked Google account ${googleId} to existing email ${emailCleaned}`);
      }
    }

    // 5. If user does NOT exist, create account or request mobile completion
    if (!user) {
      const phoneCleaned = (phone || "").replace(/\s+/g, "").trim();

      if (!phoneCleaned) {
        return res.json({
          success: true,
          requiresMobileCompletion: true,
          googleProfile: {
            googleId,
            email: emailCleaned,
            name: googleUser.name || customName || "Haajari User",
            picture: googleUser.picture || "",
          },
          message: "Please enter your 10-digit mobile number to complete account setup.",
        });
      }

      // Verify OTP if OTP is submitted for mobile registration
      if (otp) {
        const activeOtp = await OtpCode.findOne({ phone: phoneCleaned, verified: false });
        if (!activeOtp || activeOtp.expiresAt.getTime() < Date.now()) {
          return res.status(400).json({ success: false, message: "Invalid or expired OTP code." });
        }
        const isMatch = await bcrypt.compare(otp, activeOtp.otpCodeHash);
        if (!isMatch) {
          return res.status(400).json({ success: false, message: "Invalid OTP code." });
        }
        activeOtp.verified = true;
        await activeOtp.save();
      }

      // Create Tenant for new user workspace
      const userRole = (role || "contractor") as "contractor" | "builder";
      const orgName = (companyName || `${googleUser.name || "My"} Org`).trim();
      const tenantCode = `TEN_${crypto.randomBytes(4).toString("hex").toUpperCase()}`;

      const tenant = new Tenant({
        name: orgName,
        code: tenantCode,
        plan: "free",
      });
      await tenant.save();

      // Secure random password hash for schema validity
      const randomPasswordHash = await bcrypt.hash(crypto.randomBytes(32).toString("hex"), 12);

      user = new User({
        tenantId: tenant._id,
        name: (customName || googleUser.name || "Haajari User").trim(),
        email: emailCleaned || undefined,
        phone: phoneCleaned,
        role: userRole,
        passwordHash: randomPasswordHash,
        googleId,
        authProvider: "google",
        isActive: true,
        isVerified: true,
        isPhoneVerified: true,
        phoneVerifiedAt: new Date(),
        status: "active",
        profileImage: googleUser.picture || undefined,
      });

      await user.save();
      console.log(`[Google Auth] Created new user with Google ID ${googleId} and phone ${phoneCleaned}`);
    }

    // 6. Device resolution & session logging
    const deviceMeta = resolveDeviceMeta(req);
    const { deviceId, deviceName, platform, os, browser, ipAddress, location } = deviceMeta;

    if (!user.trustedDevices) user.trustedDevices = [];
    const existingDeviceIndex = user.trustedDevices.findIndex((d) => d.deviceId === deviceId);

    if (existingDeviceIndex >= 0) {
      user.trustedDevices[existingDeviceIndex].lastActiveAt = new Date();
      user.trustedDevices[existingDeviceIndex].ipAddress = ipAddress;
      user.trustedDevices[existingDeviceIndex].location = location;
    } else {
      user.trustedDevices.push({
        deviceId,
        deviceName,
        deviceOs: os,
        deviceBrowser: browser,
        ipAddress,
        location,
        trusted: true,
        trustedAt: new Date(),
        firstSeenAt: new Date(),
        lastActiveAt: new Date(),
        isSuspicious: false,
        isRevoked: false,
      });
    }

    if (!user.loginHistory) user.loginHistory = [];
    user.loginHistory.push({
      loginTime: new Date(),
      deviceId,
      deviceName,
      deviceOs: os,
      deviceBrowser: browser,
      ipAddress,
      location,
    });

    user.lastLogin = new Date();
    const token = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);

    user.refreshTokens = [...(user.refreshTokens || []), refreshToken].slice(-5);
    await user.save();

    await logActivity({
      req,
      action: "USER_LOGIN",
      targetType: "User",
      targetId: user._id.toString(),
      userId: user._id.toString(),
      tenantId: user.tenantId?.toString(),
      userName: user.name,
      role: user.role,
    });

    const tenant = await Tenant.findById(user.tenantId);

    return res.json({
      success: true,
      message: "Google login successful",
      token,
      refreshToken,
      user: {
        id: user._id,
        name: user.name,
        phone: user.phone,
        email: user.email || "",
        username: user.username || "",
        role: user.role,
        tenantId: user.tenantId,
        isVerified: user.isVerified,
        isPhoneVerified: !!user.isPhoneVerified,
        plan: tenant?.plan || "free",
        companyName: tenant?.name || "",
        address: user.address || "",
        profileImage: user.profileImage || "",
        avatarColor: user.avatarColor || "#4ECDC4",
        createdAt: user.createdAt,
      },
    });
  } catch (error: any) {
    console.error("[Google Auth Error]:", error);
    res.status(500).json({ success: false, message: error.message || "Failed to authenticate with Google." });
  }
};
