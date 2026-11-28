import crypto from "crypto";
import { v2 as cloudinary } from "cloudinary";
import { env } from "@/config/env";
import { ApiError } from "@/utils/ApiError";

const configured = !!(
  env.CLOUDINARY_CLOUD_NAME &&
  env.CLOUDINARY_API_KEY &&
  env.CLOUDINARY_API_SECRET
);

if (configured) {
  cloudinary.config({
    cloud_name: env.CLOUDINARY_CLOUD_NAME,
    api_key: env.CLOUDINARY_API_KEY,
    api_secret: env.CLOUDINARY_API_SECRET,
    secure: true,
  });
}

export type UploadPurpose = "avatar" | "technician_document" | "service_image" | "booking_photo";

const FOLDERS: Record<UploadPurpose, string> = {
  avatar: "servenest/avatars",
  technician_document: "servenest/technician-documents",
  service_image: "servenest/service-images",
  booking_photo: "servenest/booking-photos",
};

const ALLOWED_FORMATS = "jpg,jpeg,png,webp,heic";

function assertConfigured() {
  if (!configured) throw new ApiError(503, "Image uploads are not configured");
}

export const folderFor = (purpose: UploadPurpose, userId: string) =>
  `${FOLDERS[purpose]}/${userId}`;

// The phone or browser uploads straight to Cloudinary with these values
export function signUpload(purpose: UploadPurpose, userId: string) {
  assertConfigured();

  const timestamp = Math.floor(Date.now() / 1000);
  const publicId = `${folderFor(purpose, userId)}/${crypto.randomBytes(12).toString("hex")}`;

  const signature = cloudinary.utils.api_sign_request(
    { allowed_formats: ALLOWED_FORMATS, public_id: publicId, timestamp },
    env.CLOUDINARY_API_SECRET!
  );

  return {
    uploadUrl: `https://api.cloudinary.com/v1_1/${env.CLOUDINARY_CLOUD_NAME}/image/upload`,
    apiKey: env.CLOUDINARY_API_KEY!,
    timestamp,
    signature,
    publicId,
    allowedFormats: ALLOWED_FORMATS,
  };
}

// The asset must sit in this user's own folder and live on our Cloudinary account
export function assertOwnedAsset(
  purpose: UploadPurpose,
  userId: string,
  asset: { url: string; publicId: string }
) {
  assertConfigured();

  const prefix = `${folderFor(purpose, userId)}/`;
  const name = asset.publicId.startsWith(prefix) ? asset.publicId.slice(prefix.length) : "";
  const urlOk =
    asset.url.startsWith(`https://res.cloudinary.com/${env.CLOUDINARY_CLOUD_NAME}/`) &&
    asset.url.includes(asset.publicId);

  if (!/^[a-f0-9]{24}$/.test(name) || !urlOk) {
    throw ApiError.badRequest("Invalid uploaded file");
  }
}

// Best effort cleanup, never fails the request
export async function deleteAsset(publicId: string) {
  if (!configured) return;
  try {
    await cloudinary.uploader.destroy(publicId, { invalidate: true });
  } catch (err) {
    console.error("Cloudinary delete failed:", err);
  }
}