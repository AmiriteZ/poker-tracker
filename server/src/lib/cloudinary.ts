import { v2 as cloudinary } from "cloudinary";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export const uploadFolder = process.env.CLOUDINARY_UPLOAD_FOLDER ?? "poker-tracker/avatars";

/**
 * Produces a signed-upload payload so the browser can upload directly to
 * Cloudinary without ever seeing the API secret. The public_id is pinned to
 * the user's id so re-uploads overwrite the old avatar.
 */
export function signAvatarUpload(userId: string) {
  const timestamp = Math.round(Date.now() / 1000);
  const params = {
    timestamp,
    folder: uploadFolder,
    public_id: userId,
    overwrite: "true",
    transformation: "c_fill,g_face,w_512,h_512",
  };
  const signature = cloudinary.utils.api_sign_request(
    params,
    process.env.CLOUDINARY_API_SECRET ?? ""
  );
  return {
    ...params,
    signature,
    apiKey: process.env.CLOUDINARY_API_KEY,
    cloudName: process.env.CLOUDINARY_CLOUD_NAME,
  };
}

export { cloudinary };
