import * as Location from "expo-location";

export interface GPSLocation {
  latitude: number;
  longitude: number;
  accuracy?: number;
}

export async function requestLocationPermission(): Promise<
  "granted" | "denied" | "unavailable"
> {
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status === "granted") return "granted";
    return "denied";
  } catch {
    return "unavailable";
  }
}

export async function captureLocation(): Promise<GPSLocation | null> {
  try {
    const loc = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    });
    return {
      latitude: loc.coords.latitude,
      longitude: loc.coords.longitude,
      accuracy: loc.coords.accuracy ?? undefined,
    };
  } catch {
    return null;
  }
}
