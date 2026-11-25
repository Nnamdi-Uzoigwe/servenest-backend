import { Schema, model, type HydratedDocument, type Types } from "mongoose";
import {
  DOCUMENT_TYPES,
  TECHNICIAN_APPROVAL_STATUSES,
  WEEKDAYS,
  type DocumentType,
  type TechnicianApprovalStatus,
  type Weekday,
} from "@/constants/enums";

export interface ITechnicianDocument {
  type: DocumentType;
  name: string;
  url: string;
  publicId: string;
  uploadedAt: Date;
}

export interface IWorkingLocation {
  state: string;
  city: string;
}

export interface IAvailabilitySlot {
  day: Weekday;
  startTime: string; // "08:00"
  endTime: string; // "17:00"
}

export interface ITechnicianProfile {
  _id: Types.ObjectId;
  user: Types.ObjectId;
  residentialAddress: string;
  bio?: string;
  yearsOfExperience: number;
  specializations: string[];
  serviceCategories: Types.ObjectId[];
  workingLocations: IWorkingLocation[];
  weeklyAvailability: IAvailabilitySlot[];
  isAvailable: boolean;
  documents: ITechnicianDocument[];
  approvalStatus: TechnicianApprovalStatus;
  rejectionReason?: string;
  suspensionReason?: string;
  reviewedBy?: Types.ObjectId;
  reviewedAt?: Date;
  ratingAverage: number;
  ratingCount: number;
  completedJobsCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export type TechnicianProfileDocument = HydratedDocument<ITechnicianProfile>;

const documentSchema = new Schema<ITechnicianDocument>(
  {
    type: { type: String, enum: DOCUMENT_TYPES, required: true },
    name: { type: String, required: true, trim: true },
    url: { type: String, required: true },
    publicId: { type: String, required: true },
    uploadedAt: { type: Date, default: Date.now },
  },
  { _id: true }
);

const locationSchema = new Schema<IWorkingLocation>(
  {
    state: { type: String, required: true, trim: true },
    city: { type: String, required: true, trim: true },
  },
  { _id: false }
);

const slotSchema = new Schema<IAvailabilitySlot>(
  {
    day: { type: String, enum: WEEKDAYS, required: true },
    startTime: { type: String, required: true, match: /^([01]\d|2[0-3]):[0-5]\d$/ },
    endTime: { type: String, required: true, match: /^([01]\d|2[0-3]):[0-5]\d$/ },
  },
  { _id: false }
);

const technicianProfileSchema = new Schema<ITechnicianProfile>(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true, unique: true },
    residentialAddress: { type: String, required: true, trim: true },
    bio: { type: String, trim: true, maxlength: 1000 },
    yearsOfExperience: { type: Number, required: true, min: 0, max: 60 },
    specializations: { type: [String], default: [] },
    serviceCategories: [{ type: Schema.Types.ObjectId, ref: "ServiceCategory" }],
    workingLocations: { type: [locationSchema], default: [] },
    weeklyAvailability: { type: [slotSchema], default: [] },
    isAvailable: { type: Boolean, default: false },
    documents: { type: [documentSchema], default: [] },
    approvalStatus: {
      type: String,
      enum: TECHNICIAN_APPROVAL_STATUSES,
      default: "pending",
      index: true,
    },
    rejectionReason: String,
    suspensionReason: String,
    reviewedBy: { type: Schema.Types.ObjectId, ref: "User" },
    reviewedAt: Date,
    ratingAverage: { type: Number, default: 0, min: 0, max: 5 },
    ratingCount: { type: Number, default: 0, min: 0 },
    completedJobsCount: { type: Number, default: 0, min: 0 },
  },
  { timestamps: true }
);

technicianProfileSchema.index({ approvalStatus: 1, isAvailable: 1 });
technicianProfileSchema.index({ "workingLocations.state": 1, "workingLocations.city": 1 });

export const TechnicianProfile = model<ITechnicianProfile>(
  "TechnicianProfile",
  technicianProfileSchema
);