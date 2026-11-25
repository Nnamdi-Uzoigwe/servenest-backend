export const ROLES = ["customer", "technician", "admin", "dispatcher"] as const;
export type Role = (typeof ROLES)[number];

export const ACCOUNT_STATUSES = ["active", "suspended"] as const;
export type AccountStatus = (typeof ACCOUNT_STATUSES)[number];

export const TECHNICIAN_APPROVAL_STATUSES = [
  "pending",
  "approved",
  "rejected",
  "suspended",
] as const;
export type TechnicianApprovalStatus =
  (typeof TECHNICIAN_APPROVAL_STATUSES)[number];

export const DOCUMENT_TYPES = ["id_card", "certificate", "license", "other"] as const;
export type DocumentType = (typeof DOCUMENT_TYPES)[number];

export const WEEKDAYS = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
] as const;
export type Weekday = (typeof WEEKDAYS)[number];