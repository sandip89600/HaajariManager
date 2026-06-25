import { Platform } from "react-native";
import { storage, API_URL, authenticatedFetch } from "./storage";

export async function uploadImageToServer(localUri: string): Promise<string> {
  if (!localUri) throw new Error("No local URI provided");

  // If the image is already a remote URL (starts with http/https), return it as is
  if (localUri.startsWith("http://") || localUri.startsWith("https://")) {
    return localUri;
  }

  const formData = new FormData();

  const filename = localUri.split("/").pop() || "upload.jpg";
  const match = /\.(\w+)$/.exec(filename);
  const type = match ? `image/${match[1]}` : `image/jpeg`;

  formData.append("image", {
    uri: Platform.OS === "android" ? localUri : localUri.replace("file://", ""),
    name: filename,
    type,
  } as any);

  const res = await authenticatedFetch(`${API_URL}/upload`, {
    method: "POST",
    body: formData,
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(
      errorData.error || `Upload failed with status ${res.status}`,
    );
  }

  const data = await res.json();
  if (!data.url) {
    throw new Error("Invalid response format from upload server");
  }

  return data.url;
}
