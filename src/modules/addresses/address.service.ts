import { ApiError } from "@/utils/ApiError";
import { SavedAddress } from "@/modules/addresses/address.model";
import type { CreateAddressInput, UpdateAddressInput } from "@/modules/addresses/address.schemas";

const MAX_ADDRESSES = 10;

const defined = (o: object): Record<string, unknown> =>
  Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined));

const isDuplicateKey = (err: unknown) => (err as { code?: number } | null)?.code === 11000;

export function listAddresses(userId: string) {
  return SavedAddress.find({ user: userId }).sort({ isDefault: -1, createdAt: 1 }).select("-__v").lean();
}

export async function createAddress(userId: string, input: CreateAddressInput) {
  const count = await SavedAddress.countDocuments({ user: userId });
  if (count >= MAX_ADDRESSES) {
    throw ApiError.conflict(`You can save up to ${MAX_ADDRESSES} addresses. Delete one first.`);
  }

  // The first address is the default automatically
  const makeDefault = input.isDefault === true || count === 0;
  if (makeDefault) {
    await SavedAddress.updateMany({ user: userId, isDefault: true }, { $set: { isDefault: false } });
  }

  try {
    const doc = await SavedAddress.create({ ...input, user: userId, isDefault: makeDefault });
    const { __v, ...rest } = doc.toObject();
    void __v;
    return rest;
  } catch (err) {
    if (isDuplicateKey(err)) throw ApiError.conflict("Your addresses changed at the same moment. Try again.");
    throw err;
  }
}

export async function updateAddress(userId: string, id: string, input: UpdateAddressInput) {
  const existing = await SavedAddress.findOne({ _id: id, user: userId }).select("isDefault").lean();
  if (!existing) throw ApiError.notFound("Address not found");

  const { isDefault, ...fields } = input;

  if (isDefault === false && existing.isDefault) {
    throw ApiError.badRequest("Choose another address as your default instead");
  }

  if (isDefault === true && !existing.isDefault) {
    await SavedAddress.updateMany(
      { user: userId, isDefault: true, _id: { $ne: id } },
      { $set: { isDefault: false } }
    );
  }

  try {
    return await SavedAddress.findOneAndUpdate(
      { _id: id, user: userId },
      { $set: { ...defined(fields), ...(isDefault === true ? { isDefault: true } : {}) } },
      { new: true, runValidators: true }
    )
      .select("-__v")
      .lean();
  } catch (err) {
    if (isDuplicateKey(err)) throw ApiError.conflict("Your addresses changed at the same moment. Try again.");
    throw err;
  }
}

export async function deleteAddress(userId: string, id: string) {
  const removed = await SavedAddress.findOneAndDelete({ _id: id, user: userId });
  if (!removed) throw ApiError.notFound("Address not found");

  // If the default was removed, the oldest remaining address takes over.
  // Past bookings are unaffected, because they keep their own copy of the address.
  if (removed.isDefault) {
    const next = await SavedAddress.findOne({ user: userId }).sort({ createdAt: 1 }).select("_id");
    if (next) await SavedAddress.updateOne({ _id: next._id }, { $set: { isDefault: true } });
  }
}