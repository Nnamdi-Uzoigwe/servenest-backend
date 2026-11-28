export const BOOKING_STATUSES = [
  "pending_review",
  "awaiting_quotation",
  "quote_sent",
  "awaiting_payment",
  "confirmed",
  "assigned",
  "ongoing",
  "completed",
  "cancelled",
  "rejected",
] as const;
export type BookingStatus = (typeof BOOKING_STATUSES)[number];

export const BOOKING_WINDOWS = ["morning", "afternoon", "evening"] as const;
export type BookingWindow = (typeof BOOKING_WINDOWS)[number];

// Hours in Nigerian time (Africa/Lagos)
export const WINDOW_HOURS: Record<BookingWindow, { start: number; end: number }> = {
  morning: { start: 8, end: 12 },
  afternoon: { start: 12, end: 16 },
  evening: { start: 16, end: 19 },
};

export const OPEN_STATUSES: BookingStatus[] = [
  "pending_review",
  "awaiting_quotation",
  "quote_sent",
  "awaiting_payment",
  "confirmed",
  "assigned",
  "ongoing",
];

export const HISTORY_STATUSES: BookingStatus[] = ["completed", "cancelled", "rejected"];

// Business rule 9: every status change must follow this map
export const BOOKING_TRANSITIONS: Record<BookingStatus, readonly BookingStatus[]> = {
  pending_review: ["awaiting_quotation", "rejected", "cancelled"],
  awaiting_quotation: ["quote_sent", "cancelled"],
  // Back to awaiting_quotation when the customer declines and a revised quote is needed
  quote_sent: ["awaiting_payment", "awaiting_quotation", "cancelled"],
  awaiting_payment: ["confirmed", "cancelled"],
  confirmed: ["assigned", "cancelled"],
  // Back to confirmed when a technician turns the job down
  assigned: ["ongoing", "confirmed", "cancelled"],
  ongoing: ["completed"],
  completed: [],
  cancelled: [],
  rejected: [],
};

// Customers can cancel until a technician is on the way
export const CUSTOMER_CANCELLABLE: readonly BookingStatus[] = [
  "pending_review",
  "awaiting_quotation",
  "quote_sent",
  "awaiting_payment",
  "confirmed",
  "assigned",
];

// Used inside error messages, for example "This booking is already in progress"
export const STATUS_PHRASES: Record<BookingStatus, string> = {
  pending_review: "waiting for review",
  awaiting_quotation: "waiting for a quote",
  quote_sent: "waiting for your reply to a quote",
  awaiting_payment: "waiting for payment",
  confirmed: "confirmed",
  assigned: "assigned to a technician",
  ongoing: "already in progress",
  completed: "completed",
  cancelled: "cancelled",
  rejected: "declined",
};