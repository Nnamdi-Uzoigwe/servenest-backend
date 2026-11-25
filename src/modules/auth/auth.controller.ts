import type { Request, Response } from "express";
import * as authService from "@/modules/auth/auth.service";

const meta = (req: Request) => ({ ip: req.ip, userAgent: req.get("user-agent") });
const ok = (res: Response, data?: unknown, message?: string, status = 200) =>
  res.status(status).json({ success: true, ...(message ? { message } : {}), ...(data ? { data } : {}) });

export async function registerCustomer(req: Request, res: Response) {
  ok(res, await authService.registerCustomer(req.body, meta(req)), undefined, 201);
}

export async function registerTechnician(req: Request, res: Response) {
  ok(res, await authService.registerTechnician(req.body, meta(req)), undefined, 201);
}

export async function login(req: Request, res: Response) {
  ok(res, await authService.login(req.body, meta(req)));
}

export async function refresh(req: Request, res: Response) {
  ok(res, { tokens: await authService.refresh(req.body.refreshToken, meta(req)) });
}

export async function logout(req: Request, res: Response) {
  await authService.logout(req.body.refreshToken);
  ok(res, undefined, "Logged out");
}

export async function logoutAll(req: Request, res: Response) {
  await authService.logoutAll(req.auth!.userId);
  ok(res, undefined, "Logged out of all devices");
}

export async function me(req: Request, res: Response) {
  ok(res, await authService.getMe(req.auth!.userId));
}

export async function verifyEmail(req: Request, res: Response) {
  await authService.verifyEmail(req.auth!.userId, req.body.code);
  ok(res, undefined, "Email verified");
}

export async function resendVerification(req: Request, res: Response) {
  await authService.resendVerification(req.auth!.userId);
  ok(res, undefined, "Verification code sent");
}

export async function forgotPassword(req: Request, res: Response) {
  await authService.forgotPassword(req.body.email);
  ok(res, undefined, "If an account exists for that email, a reset code has been sent");
}

export async function resetPassword(req: Request, res: Response) {
  await authService.resetPassword(req.body);
  ok(res, undefined, "Password reset successful. Please log in.");
}