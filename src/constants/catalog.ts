export const ICON_KEYS = [
  "plumbing",
  "electrical",
  "ac",
  "cleaning",
  "generator",
  "painting",
  "appliance",
  "carpentry",
  "pest",
  "maintenance",
  "other",
] as const;

export type IconKey = (typeof ICON_KEYS)[number];