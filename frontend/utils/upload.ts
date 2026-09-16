import { Platform } from "react-native";
import * as FileSystem from "expo-file-system/legacy";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { API_URL } from "./apiConfig";
import { authenticatedFetch } from "./apiClient";
import { getDeviceHeaders } from "./device";

export async function uploadImageToServer(localUri: string): Promise<string> {
  if (!localUri) throw new Error("No local URI provided");

  // If the image is already a remote URL (starts with http/https), return it as is
  if (localUri.startsWith("http://") || localUri.startsWith("https://")) {
    return localUri;
  }

  const uploadEndpoint = `${API_URL}/upload`;
  const authDataRaw = await AsyncStorage.getItem("@haajari/auth").catch(() => null);
  const auth = authDataRaw ? JSON.parse(authDataRaw) : null;
  const token = auth?.token || "";
  const deviceHeaders = await getDeviceHeaders().catch(() => ({}) as Record<string, string>);

  // 1. Primary Method for Native (iOS / Android): FileSystem.uploadAsync (bypasses JS FormData entirely)
  if (Platform.OS !== "web") {
    try {
      const uploadRes = await FileSystem.uploadAsync(uploadEndpoint, localUri, {
        httpMethod: "POST",
        uploadType: FileSystem.FileSystemUploadType.MULTIPART,
        fieldName: "image",
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...deviceHeaders,
        },
      });

      if (uploadRes.status >= 200 && uploadRes.status < 300) {
        const body = JSON.parse(uploadRes.body || "{}");
        if (body.url) {
          return body.url;
        }
      }
      console.warn(`uploadAsync returned status ${uploadRes.status}: ${uploadRes.body}`);
    } catch (fsErr: any) {
      console.warn("FileSystem.uploadAsync failed, trying Base64 fallback:", fsErr?.message || fsErr);
    }
  }

  // 2. Base64 JSON Fallback (Bulletproof across all Android/iOS networks & proxies)
  try {
    let base64 = "";
    if (Platform.OS !== "web") {
      base64 = await FileSystem.readAsStringAsync(localUri, {
        encoding: FileSystem.EncodingType.Base64,
      });
    }

    if (base64) {
      const filename = localUri.split("/").pop() || "upload.jpg";
      const match = /\.(\w+)$/.exec(filename);
      const mimeType = match ? `image/${match[1]}` : "image/jpeg";

      const res = await authenticatedFetch(uploadEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageBase64: base64,
          filename,
          mimeType,
        }),
        timeoutMs: 25000,
      });

      if (res.ok) {
        const data = await res.json();
        if (data.url) return data.url;
      }
    }
  } catch (b64Err: any) {
    console.warn("Base64 upload fallback failed:", b64Err?.message || b64Err);
  }

  // 3. Web / Standard FormData Fallback
  const formData = new FormData();
  const filename = localUri.split("/").pop() || "upload.jpg";
  const match = /\.(\w+)$/.exec(filename);
  const type = match ? `image/${match[1]}` : `image/jpeg`;

  formData.append("image", {
    uri: localUri,
    name: filename,
    type,
  } as any);

  const res = await authenticatedFetch(uploadEndpoint, {
    method: "POST",
    body: formData,
    timeoutMs: 25000,
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
