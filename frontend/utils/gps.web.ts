export interface GPSLocation {
  latitude: number;
  longitude: number;
  accuracy?: number;
}

export async function captureLocation(): Promise<GPSLocation | null> {
  return null;
}

export async function requestLocationPermission(): Promise<
  "granted" | "denied" | "unavailable"
> {
  return "unavailable";
}
