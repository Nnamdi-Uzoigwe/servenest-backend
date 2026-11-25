import type { Types } from "mongoose";
import { env } from "@/config/env";
import { ApiError } from "@/utils/ApiError";
import {
  generateOpaqueToken,
  generateOtp,
  hashToken,
  safeEqual,
  signAccessToken,
} from "@/utils/tokens";
import { DUMMY_HASH, hashPassword, verifyPassword } from "@/utils/password";
import { sendPasswordResetCode, sendVerificationCode } from "@/services/email.service";
import { User, type UserDocument } from "@/modules/users/user.model";
import { CustomerProfile } from "@/modules/customers/customerProfile.model";
import { TechnicianProfile } from "@/modules/technicians/technicianProfile.model";
import type {
  LoginInput,
  RegisterCustomerInput,
  RegisterTechnicianInput,
  ResetPasswordInput,
} from "@/modules/auth/auth.schemas";

const REFRESH_TTL_MS = env.REFRESH_TOKEN_DAYS * 24 * 60 * 60 * 1000;
const OTP_TTL_MS = 10 * 60 * 1000;
const RESEND_COOLDOWN_MS = 60 * 1000;
const MAX_SESSIONS = 5;

export interface ClientMeta {
  ip?: string;
  userAgent?: string;
}

// Tokens

async function issueTokens(userId: Types.ObjectId, meta: ClientMeta) {
  const refreshToken = generateOpaqueToken();

  await User.updateOne(
    { _id: userId },
    {
      $push: {
        refreshTokens: {
          $each: [
            {
              tokenHash: hashToken(refreshToken),
              expiresAt: new Date(Date.now() + REFRESH_TTL_MS),
              userAgent: meta.userAgent,
              ip: meta.ip,
              createdAt: new Date(),
            },
          ],
          // Keep only the most recent sessions
          $slice: -MAX_SESSIONS,
        },
      },
    }
  );

  return { accessToken: signAccessToken(String(userId)), refreshToken };
}

async function getTechnicianSummary(user: { _id: Types.ObjectId; role: string }) {
  if (user.role !== "technician") return null;
  return TechnicianProfile.findOne({ user: user._id })
    .select("approvalStatus rejectionReason suspensionReason isAvailable")
    .lean();
}

async function buildAuthResponse(user: UserDocument, meta: ClientMeta) {
  const [tokens, technicianProfile] = await Promise.all([
    issueTokens(user._id, meta),
    getTechnicianSummary(user),
  ]);
  return { user: user.toJSON(), technicianProfile, tokens };
}

// Codes

async function issueVerificationCode(user: Pick<UserDocument, "_id" | "email" | "fullName">) {
  const code = generateOtp();
  await User.updateOne(
    { _id: user._id },
    {
      emailVerificationTokenHash: hashToken(code),
      emailVerificationExpires: new Date(Date.now() + OTP_TTL_MS),
    }
  );
  await sendVerificationCode(user.email, user.fullName, code);
}

// Registration

async function assertUnique(email: string, phone?: string) {
  if (await User.exists({ email })) {
    throw ApiError.conflict("An account with this email already exists");
  }
  if (phone && (await User.exists({ phone }))) {
    throw ApiError.conflict("An account with this phone number already exists");
  }
}

export async function registerCustomer(input: RegisterCustomerInput, meta: ClientMeta) {
  await assertUnique(input.email, input.phone);

  const user = await User.create({
    fullName: input.fullName,
    email: input.email,
    phone: input.phone,
    passwordHash: await hashPassword(input.password),
    role: "customer",
  });

  try {
    await CustomerProfile.create({ user: user._id });
  } catch (err) {
    await User.deleteOne({ _id: user._id });
    throw err;
  }

  await issueVerificationCode(user);
  return buildAuthResponse(user, meta);
}

export async function registerTechnician(input: RegisterTechnicianInput, meta: ClientMeta) {
  await assertUnique(input.email, input.phone);

  const user = await User.create({
    fullName: input.fullName,
    email: input.email,
    phone: input.phone,
    passwordHash: await hashPassword(input.password),
    role: "technician",
  });

  try {
    await TechnicianProfile.create({
      user: user._id,
      residentialAddress: input.residentialAddress,
      bio: input.bio,
      yearsOfExperience: input.yearsOfExperience,
      specializations: input.specializations,
      workingLocations: input.workingLocations,
      weeklyAvailability: input.weeklyAvailability,
    });
  } catch (err) {
    await User.deleteOne({ _id: user._id });
    throw err;
  }

  await issueVerificationCode(user);
  return buildAuthResponse(user, meta);
}

// Login, refresh, logout

export async function login(input: LoginInput, meta: ClientMeta) {
  const user = await User.findOne({ email: input.email }).select("+passwordHash");
  const valid = await verifyPassword(input.password, user?.passwordHash ?? DUMMY_HASH);

  if (!user || !valid) throw ApiError.unauthorized("Invalid email or password");
  if (user.status === "suspended") {
    throw ApiError.forbidden("Your account has been suspended. Contact support.");
  }

  await User.updateOne(
    { _id: user._id },
    {
      $set: { lastLoginAt: new Date() },
      $pull: { refreshTokens: { expiresAt: { $lt: new Date() } } },
    }
  );

  return buildAuthResponse(user, meta);
}

export async function refresh(refreshToken: string, meta: ClientMeta) {
  const tokenHash = hashToken(refreshToken);

  // Atomically consume the token so it can only be used once
  const user = await User.findOneAndUpdate(
    { refreshTokens: { $elemMatch: { tokenHash, expiresAt: { $gt: new Date() } } } },
    { $pull: { refreshTokens: { tokenHash } } }
  );

  if (!user) throw ApiError.unauthorized("Invalid or expired refresh token");
  if (user.status === "suspended") {
    throw ApiError.forbidden("Your account has been suspended. Contact support.");
  }

  return issueTokens(user._id, meta);
}

export async function logout(refreshToken: string) {
  const tokenHash = hashToken(refreshToken);
  await User.updateOne(
    { "refreshTokens.tokenHash": tokenHash },
    { $pull: { refreshTokens: { tokenHash } } }
  );
}

export async function logoutAll(userId: string) {
  await User.updateOne({ _id: userId }, { $set: { refreshTokens: [] } });
}

// Current user

export async function getMe(userId: string) {
  const user = await User.findById(userId);
  if (!user) throw ApiError.notFound("User not found");
  const technicianProfile = await getTechnicianSummary(user);
  return { user: user.toJSON(), technicianProfile };
}

// Email verification

export async function verifyEmail(userId: string, code: string) {
  const user = await User.findById(userId).select(
    "+emailVerificationTokenHash +emailVerificationExpires"
  );
  if (!user) throw ApiError.notFound("User not found");
  if (user.isEmailVerified) return;

  const valid =
    user.emailVerificationTokenHash &&
    user.emailVerificationExpires &&
    user.emailVerificationExpires > new Date() &&
    safeEqual(user.emailVerificationTokenHash, hashToken(code));

  if (!valid) throw ApiError.badRequest("Invalid or expired verification code");

  user.isEmailVerified = true;
  user.emailVerificationTokenHash = undefined;
  user.emailVerificationExpires = undefined;
  await user.save();
}

export async function resendVerification(userId: string) {
  const user = await User.findById(userId).select("+emailVerificationExpires");
  if (!user) throw ApiError.notFound("User not found");
  if (user.isEmailVerified) throw ApiError.badRequest("Email is already verified");

  if (user.emailVerificationExpires) {
    const sentAt = user.emailVerificationExpires.getTime() - OTP_TTL_MS;
    if (Date.now() - sentAt < RESEND_COOLDOWN_MS) {
      throw new ApiError(429, "Please wait a minute before requesting another code");
    }
  }

  await issueVerificationCode(user);
}

// Password reset

export async function forgotPassword(email: string) {
  // Always succeeds from the caller's point of view, so emails cannot be enumerated
  const user = await User.findOne({ email });
  if (!user || user.status === "suspended") return;

  const code = generateOtp();
  await User.updateOne(
    { _id: user._id },
    {
      passwordResetTokenHash: hashToken(code),
      passwordResetExpires: new Date(Date.now() + OTP_TTL_MS),
    }
  );
  await sendPasswordResetCode(user.email, user.fullName, code);
}

export async function resetPassword(input: ResetPasswordInput) {
  const user = await User.findOne({ email: input.email }).select(
    "+passwordResetTokenHash +passwordResetExpires +refreshTokens"
  );

  const valid =
    user &&
    user.passwordResetTokenHash &&
    user.passwordResetExpires &&
    user.passwordResetExpires > new Date() &&
    safeEqual(user.passwordResetTokenHash, hashToken(input.code));

  if (!user || !valid) throw ApiError.badRequest("Invalid or expired reset code");

  user.passwordHash = await hashPassword(input.newPassword);
  user.passwordResetTokenHash = undefined;
  user.passwordResetExpires = undefined;
  // They proved access to this inbox, and every device must log in again
  user.isEmailVerified = true;
  user.refreshTokens = [];
  await user.save();
}