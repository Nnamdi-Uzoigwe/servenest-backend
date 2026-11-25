import { ApiError } from "@/utils/ApiError";
import { assertOwnedAsset, deleteAsset } from "@/services/cloudinary.service";
import { User } from "@/modules/users/user.model";

export async function setAvatar(userId: string, asset: { url: string; publicId: string }) {
  assertOwnedAsset("avatar", userId, asset);

  const current = await User.findById(userId).select("avatar");
  if (!current) throw ApiError.notFound("User not found");

  const updated = await User.findByIdAndUpdate(
    userId,
    { $set: { avatar: { url: asset.url, publicId: asset.publicId } } },
    { new: true }
  );

  // Remove the previous photo from Cloudinary
  const oldId = current.avatar?.publicId;
  if (oldId && oldId !== asset.publicId) void deleteAsset(oldId);

  return updated!.toJSON();
}