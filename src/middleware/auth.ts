import type { NextFunction, Request, Response } from "express";
import { ApiError } from "@/utils/ApiError";
import { verifyAccessToken } from "@/utils/tokens";
import { User } from "@/modules/users/user.model";

export async function authenticate(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    throw ApiError.unauthorized("Missing access token");
  }

  const { userId } = verifyAccessToken(header.slice(7));

  // Role and status come from the database, never from the token
  const user = await User.findById(userId).select("role status isEmailVerified");
  if (!user) throw ApiError.unauthorized("Account no longer exists");
  if (user.status === "suspended") {
    throw ApiError.forbidden("Your account has been suspended. Contact support.");
  }

  req.auth = {
    userId: String(user._id),
    role: user.role,
    isEmailVerified: user.isEmailVerified,
  };
  next();
}

export function requireVerifiedEmail(req: Request, _res: Response, next: NextFunction) {
  if (!req.auth?.isEmailVerified) {
    throw ApiError.forbidden("Please verify your email address first");
  }
  next();
}