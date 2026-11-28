import { Types } from "mongoose";
import {
  BOOKING_TRANSITIONS,
  CUSTOMER_CANCELLABLE,
  HISTORY_STATUSES,
  OPEN_STATUSES,
  STATUS_PHRASES,
  WINDOW_HOURS,
  type BookingStatus,
  type BookingWindow,
} from "@/constants/booking";
import type { Role } from "@/constants/enums";
import { ApiError } from "@/utils/ApiError";
import { addDays, lagosNow } from "@/utils/lagosTime";
import { assertOwnedAsset } from "@/services/cloudinary.service";
import { SavedAddress } from "@/modules/addresses/address.model";
import { OBJECT_ID } from "@/modules/catalog/catalog.schemas";
import { ServiceCategory } from "@/modules/catalog/category.model";
import { Service } from "@/modules/catalog/service.model";
import { Booking, type IStatusEvent } from "@/modules/bookings/booking.model";
import { nextSequence } from "@/modules/bookings/counter.model";
import type { CreateBookingInput, ListBookingsQuery } from "@/modules/bookings/booking.schemas";

const MAX_PENDING_REQUESTS = 10;
const MAX_DAYS_AHEAD = 60;

const isDuplicateKey = (err: unknown) => (err as { code?: number } | null)?.code === 11000;

// What a customer gets to see: no internal fields, and no names or ids of who made each change
function present<T extends object>(doc: T) {
  const { __v, clientRequestId, statusHistory, ...rest } = doc as T & {
    __v?: number;
    clientRequestId?: string;
    statusHistory?: IStatusEvent[];
  };
  void __v;
  void clientRequestId;

  return {
    ...rest,
    ...(statusHistory
      ? {
          statusHistory: statusHistory.map(({ status, at, note }) => ({
            status,
            at,
            ...(note ? { note } : {}),
          })),
        }
      : {}),
  };
}

// A booking can be found by its id or by its reference, for example SN-000123
function lookupKey(idOrRef: string): Record<string, string> | null {
  if (OBJECT_ID.test(idOrRef)) return { _id: idOrRef };
  if (/^SN-\d{6,}$/i.test(idOrRef)) return { reference: idOrRef.toUpperCase() };
  return null;
}

function assertSchedule(date: string, window: BookingWindow) {
  const now = lagosNow();

  if (date < now.date) {
    const message = "Choose today or a later date";
    throw ApiError.badRequest(message, { preferredDate: message });
  }

  if (date > addDays(now.date, MAX_DAYS_AHEAD)) {
    const message = `Choose a date within the next ${MAX_DAYS_AHEAD} days`;
    throw ApiError.badRequest(message, { preferredDate: message });
  }

  if (date === now.date && WINDOW_HOURS[window].end - now.hour < 1) {
    const message = "That time window has already passed. Choose a later window or another day.";
    throw ApiError.badRequest(message, { preferredWindow: message });
  }
}

// Creating

export async function createBooking(userId: string, input: CreateBookingInput) {
  // A retry of a request we already handled returns the same booking
  if (input.clientRequestId) {
    const existing = await Booking.findOne({ customer: userId, clientRequestId: input.clientRequestId }).lean();
    if (existing) return { booking: present(existing), created: false as const };
  }

  const service = await Service.findOne({ _id: input.serviceId, isActive: true }).lean();
  const category = service
    ? await ServiceCategory.findOne({ _id: service.category, isActive: true }).select("name").lean()
    : null;

  if (!service || !category) throw ApiError.notFound("Service not found");
  if (!service.isAvailable) throw ApiError.conflict("This service is not taking bookings right now");

  const address = await SavedAddress.findOne({ _id: input.addressId, user: userId }).lean();
  if (!address) {
    const message = "Choose one of your saved addresses";
    throw ApiError.badRequest(message, { addressId: message });
  }

  assertSchedule(input.preferredDate, input.preferredWindow);

  // Each photo must come from this customer's own upload folder
  const seen = new Set<string>();
  for (const photo of input.photos) {
    assertOwnedAsset("booking_photo", userId, photo);
    if (seen.has(photo.publicId)) throw ApiError.badRequest("The same photo was added twice");
    seen.add(photo.publicId);
  }

  const waiting = await Booking.countDocuments({ customer: userId, status: "pending_review" });
  if (waiting >= MAX_PENDING_REQUESTS) {
    throw new ApiError(
      429,
      `You already have ${MAX_PENDING_REQUESTS} requests waiting for review. Wait for a decision before sending more.`
    );
  }

  const reference = `SN-${String(await nextSequence("booking")).padStart(6, "0")}`;

  try {
    const doc = await Booking.create({
      reference,
      customer: userId,
      service: service._id,
      serviceSnapshot: {
        name: service.name,
        categoryName: category.name,
        startingPrice: service.startingPrice,
        estimatedDurationMinutes: service.estimatedDurationMinutes,
      },
      description: input.description,
      photos: input.photos,
      address: {
        label: address.label,
        street: address.street,
        landmark: address.landmark,
        city: address.city,
        state: address.state,
      },
      contactPhone: input.contactPhone,
      preferredDate: input.preferredDate,
      preferredWindow: input.preferredWindow,
      status: "pending_review",
      statusHistory: [
        { status: "pending_review", at: new Date(), by: userId, byRole: "customer" as Role },
      ],
      clientRequestId: input.clientRequestId,
    });

    return { booking: present(doc.toObject()), created: true as const };
  } catch (err) {
    // Two copies of the same request arrived at the same moment, and the other one won
    if (isDuplicateKey(err) && input.clientRequestId) {
      const existing = await Booking.findOne({
        customer: userId,
        clientRequestId: input.clientRequestId,
      }).lean();
      if (existing) return { booking: present(existing), created: false as const };
    }
    throw err;
  }
}

// Reading

export async function listMyBookings(userId: string, q: ListBookingsQuery) {
  const filter: Record<string, unknown> = { customer: userId };
  if (q.status) filter.status = q.status;
  else if (q.group === "open") filter.status = { $in: OPEN_STATUSES };
  else if (q.group === "history") filter.status = { $in: HISTORY_STATUSES };

  const [items, total] = await Promise.all([
    Booking.find(filter)
      .sort({ createdAt: -1, _id: -1 })
      .skip((q.page - 1) * q.limit)
      .limit(q.limit)
      .select("-__v -clientRequestId -statusHistory")
      .lean(),
    Booking.countDocuments(filter),
  ]);

  return {
    items,
    pagination: { page: q.page, limit: q.limit, total, pages: Math.ceil(total / q.limit) },
  };
}

export async function getMyBooking(userId: string, idOrRef: string) {
  const key = lookupKey(idOrRef);
  if (!key) throw ApiError.notFound("Booking not found");

  // The customer filter is what keeps one customer out of another's bookings.
  // A booking that is not theirs looks exactly like one that does not exist.
  const booking = await Booking.findOne({ ...key, customer: userId }).select("-__v -clientRequestId").lean();
  if (!booking) throw ApiError.notFound("Booking not found");

  return present(booking);
}

// Changing status

interface TransitionOptions {
  // Narrows the allowed starting statuses further, for example to what a customer may cancel
  fromOnly?: readonly BookingStatus[];
  note?: string;
  set?: Record<string, unknown>;
}

// The one place a booking's status changes. It is a single atomic update that only applies
// when the booking is in a status the lifecycle allows, and it records the change in the history.
// Returns null when the booking does not match, or is no longer in a status that may change.
export async function transitionBooking(
  filter: Record<string, unknown>,
  to: BookingStatus,
  actor: { id: string; role: Role },
  opts: TransitionOptions = {}
) {
  let allowedFrom = (Object.keys(BOOKING_TRANSITIONS) as BookingStatus[]).filter((from) =>
    BOOKING_TRANSITIONS[from].includes(to)
  );
  if (opts.fromOnly) allowedFrom = allowedFrom.filter((s) => opts.fromOnly!.includes(s));

  const event: IStatusEvent = {
    status: to,
    at: new Date(),
    by: new Types.ObjectId(actor.id),
    byRole: actor.role,
    ...(opts.note ? { note: opts.note } : {}),
  };

  return Booking.findOneAndUpdate(
    { ...filter, status: { $in: allowedFrom } },
    { $set: { status: to, ...opts.set }, $push: { statusHistory: event } },
    { new: true }
  )
    .select("-__v -clientRequestId")
    .lean();
}

export async function cancelMyBooking(userId: string, idOrRef: string, reason?: string) {
  const key = lookupKey(idOrRef);
  if (!key) throw ApiError.notFound("Booking not found");

  const updated = await transitionBooking(
    { ...key, customer: userId },
    "cancelled",
    { id: userId, role: "customer" },
    {
      fromOnly: CUSTOMER_CANCELLABLE,
      note: reason,
      set: { cancellation: { by: "customer", ...(reason ? { reason } : {}), at: new Date() } },
    }
  );

  if (updated) return present(updated);

  // Work out why nothing changed
  const current = await Booking.findOne({ ...key, customer: userId }).select("status").lean();
  if (!current) throw ApiError.notFound("Booking not found");

  throw ApiError.conflict(
    current.status === "cancelled"
      ? "This booking is already cancelled"
      : `This booking cannot be cancelled because it is ${STATUS_PHRASES[current.status]}`
  );
}