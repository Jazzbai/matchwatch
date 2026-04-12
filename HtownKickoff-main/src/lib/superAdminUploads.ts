"use client";

const MAX_IMAGE_FILE_SIZE = 4 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

export type SuperAdminImagePurpose = "entity_primary" | "entity_hero";

type SuperAdminPresignedUpload = {
  success?: boolean;
  data?: {
    uploadUrl: string;
    publicUrl: string;
    uploadHeaders?: Record<string, string>;
    key: string;
  };
  error?: {
    message?: string;
  };
};

function getErrorMessage(payload: unknown, fallback: string) {
  if (payload && typeof payload === "object" && "error" in payload) {
    const error = (payload as { error?: { message?: string } }).error;
    if (error?.message) return error.message;
  }
  return fallback;
}

export function validateImageUploadFile(file: File) {
  if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
    return "Only JPG, PNG, WEBP, and GIF files are allowed.";
  }
  if (file.size > MAX_IMAGE_FILE_SIZE) {
    return "Image is too large. Maximum file size is 4MB.";
  }
  return null;
}

export async function uploadSuperAdminImage(file: File, purpose: SuperAdminImagePurpose) {
  const validationError = validateImageUploadFile(file);
  if (validationError) throw new Error(validationError);

  const presignedResponse = await fetch("/api/v1/super-admin/uploads/presigned-url", {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      filename: file.name,
      contentType: file.type,
      purpose,
      fileSize: file.size,
    }),
  });

  const presignedPayload = await presignedResponse.json().catch(() => null) as SuperAdminPresignedUpload | null;
  if (!presignedResponse.ok || !presignedPayload?.data) {
    throw new Error(getErrorMessage(presignedPayload, "Failed to prepare image upload."));
  }

  const uploadResult = await fetch(presignedPayload.data.uploadUrl, {
    method: "PUT",
    headers: {
      "Content-Type": file.type,
      ...(presignedPayload.data.uploadHeaders || {}),
    },
    body: file,
  });

  if (!uploadResult.ok) {
    throw new Error("Image upload failed. Check storage configuration and try again.");
  }

  return {
    url: presignedPayload.data.publicUrl,
    key: presignedPayload.data.key,
    previewUrl: URL.createObjectURL(file),
  };
}
