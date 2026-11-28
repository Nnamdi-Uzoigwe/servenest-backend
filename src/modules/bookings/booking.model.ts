import { Schema, model, type Types } from "mongoose";
import {
  BOOKING_STATUSES,
  BOOKING_WINDOWS,
  type BookingStatus,
  type BookingWindow,
} from "@/constants/booking";
import { ROLES, type Role } from "@/constants/enums";

export interface IBookingPhoto {
  url: string;
  publicId: string;
}

// A copy of the address at the time of booking
export interface IBookingAddress {
  label: string;
  street: string;
  landmark: string;
  city: string;
  state: string;
}

// A copy of the service at the time of booking
export interface IServiceSnapshot {
  name: string;
  categoryName: string;
  // Whole kobo
  startingPrice: number;
  estimatedDurationMinutes: number;
}

export interface IStatusEvent {
  status: BookingStatus;
  at: Date;
  by?: Types.ObjectId;
  byRole?: Role;
  // Shown to the customer, so keep internal remarks out of it
  note?: string;
}

export interface IBookingCancellation {
  by: "customer" | "admin";
  reason?: string;
  at: Date;
}

export interface IBooking {
  _id: Types.ObjectId;
  // Readable number, for example SN-000123
  reference: string;
  customer: Types.ObjectId;
  service: Types.ObjectId;
  serviceSnapshot: IServiceSnapshot;
  description: string;
  photos: IBookingPhoto[];
  address: IBookingAddress;
  contactPhone: string;
  // YYYY-MM-DD in Nigerian time
  preferredDate: string;
  preferredWindow: BookingWindow;
  status: BookingStatus;
  statusHistory: IStatusEvent[];
  rejectionReason?: string;
  cancellation?: IBookingCancellation;
  // Sent by the app so a retry returns the same booking instead of creating a second one
  clientRequestId?: string;
  createdAt: Date;
  updatedAt: Date;
}

const photoSchema = new Schema<IBookingPhoto>(
  { url: { type: String, required: true }, publicId: { type: String, required: true } },
  { _id: false }
);

const addressSchema = new Schema<IBookingAddress>(
  {
    label: { type: String, default: "", trim: true },
    street: { type: String, required: true, trim: true },
    landmark: { type: String, default: "", trim: true },
    city: { type: String, required: true, trim: true },
    state: { type: String, required: true, trim: true },
  },
  { _id: false }
);

const snapshotSchema = new Schema<IServiceSnapshot>(
  {
    name: { type: String, required: true },
    categoryName: { type: String, required: true },
    startingPrice: { type: Number, required: true, min: 0 },
    estimatedDurationMinutes: { type: Number, required: true, min: 1 },
  },
  { _id: false }
);

const eventSchema = new Schema<IStatusEvent>(
  {
    status: { type: String, enum: BOOKING_STATUSES, required: true },
    at: { type: Date, required: true },
    by: { type: Schema.Types.ObjectId, ref: "User" },
    byRole: { type: String, enum: ROLES },
    note: { type: String, maxlength: 500 },
  },
  { _id: false }
);

const cancellationSchema = new Schema<IBookingCancellation>(
  {
    by: { type: String, enum: ["customer", "admin"], required: true },
    reason: { type: String, maxlength: 500 },
    at: { type: Date, required: true },
  },
  { _id: false }
);

const bookingSchema = new Schema<IBooking>(
  {
    reference: { type: String, required: true, unique: true },
    customer: { type: Schema.Types.ObjectId, ref: "User", required: true },
    service: { type: Schema.Types.ObjectId, ref: "Service", required: true },
    serviceSnapshot: { type: snapshotSchema, required: true },
    description: { type: String, required: true, trim: true, minlength: 10, maxlength: 1000 },
    photos: { type: [photoSchema], default: [] },
    address: { type: addressSchema, required: true },
    contactPhone: { type: String, required: true, trim: true },
    preferredDate: { type: String, required: true, match: /^\d{4}-\d{2}-\d{2}$/ },
    preferredWindow: { type: String, enum: BOOKING_WINDOWS, required: true },
    status: { type: String, enum: BOOKING_STATUSES, default: "pending_review" },
    statusHistory: { type: [eventSchema], default: [] },
    rejectionReason: { type: String, maxlength: 500 },
    cancellation: cancellationSchema,
    clientRequestId: { type: String, minlength: 8, maxlength: 64 },
  },
  { timestamps: true }
);

bookingSchema.index({ customer: 1, createdAt: -1 });
bookingSchema.index({ customer: 1, status: 1 });
// The admin queue: oldest waiting first
bookingSchema.index({ status: 1, createdAt: 1 });
bookingSchema.index({ preferredDate: 1 });
bookingSchema.index(
  { customer: 1, clientRequestId: 1 },
  { unique: true, partialFilterExpression: { clientRequestId: { $type: "string" } } }
);

export const Booking = model<IBooking>("Booking", bookingSchema);