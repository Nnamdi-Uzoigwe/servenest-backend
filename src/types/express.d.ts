import type { Role } from "@/constants/enums";

declare global {
  namespace Express {
    interface Request {
      auth?: {
        userId: string;
        role: Role;
        isEmailVerified: boolean;
        // Set by requireApprovedTechnician
        technicianProfileId?: string;
      };
    }
  }
}

export {};