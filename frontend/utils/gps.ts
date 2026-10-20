import * as Location from "expo-location";
import { Linking, Platform } from "react-native";

export interface GPSLocation {
  latitude: number;
  longitude: number;
  accuracy?: number;
}

export interface LocationPermissionState {
  granted: boolean;
  canAskAgain: boolean;
  status: Location.PermissionStatus | "unavailable";
}

export interface DetailedLocationResult {
  success: boolean;
  coords: GPSLocation | null;
  errorType?: "SERVICES_DISABLED" | "PERMISSION_DENIED" | "TIMEOUT" | "UNAVAILABLE";
  errorMessage?: string;
}

/**
 * 1. Check current permission status without requesting
 */
export async function checkLocationPermissionStatus(): Promise<LocationPermissionState> {
  try {
    const { status, canAskAgain, granted } = await Location.getForegroundPermissionsAsync();
    return {
      granted: granted || status === Location.PermissionStatus.GRANTED,
      canAskAgain,
      status,
    };
  } catch {
    return {
      granted: false,
      canAskAgain: true,
      status: "unavailable",
    };
  }
}

/**
 * 2. Request location permission
 */
export async function requestLocationPermission(): Promise<"granted" | "denied" | "unavailable"> {
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status === Location.PermissionStatus.GRANTED) return "granted";
    return "denied";
  } catch {
    return "unavailable";
  }
}

/**
 * 3. Check if device location services (GPS toggle) are enabled
 */
export async function checkLocationServicesEnabled(): Promise<boolean> {
  try {
    return await Location.hasServicesEnabledAsync();
  } catch {
    return false;
  }
}

/**
 * 4. Prompt user to enable device location services
 * On Android, attempts enableNetworkProviderAsync.
 * Otherwise, opens device settings.
 */
export async function promptEnableLocationServices(): Promise<boolean> {
  try {
    if (Platform.OS === "android") {
      await Location.enableNetworkProviderAsync();
      return await Location.hasServicesEnabledAsync();
    } else {
      await Linking.openSettings();
      return false;
    }
  } catch {
    await Linking.openSettings().catch(() => {});
    return false;
  }
}

/**
 * 5. Open device application settings
 */
export async function openAppSettings(): Promise<void> {
  try {
    await Linking.openSettings();
  } catch (err) {
    console.warn("Could not open settings:", err);
  }
}

/**
 * 6. Obtain current GPS coordinates with timeout and fallback
 */
export async function acquireAccurateGPS(timeoutMs: number = 9000): Promise<DetailedLocationResult> {
  // Step 1: Check permissions
  const perm = await checkLocationPermissionStatus();
  if (!perm.granted) {
    const req = await requestLocationPermission();
    if (req !== "granted") {
      return {
        success: false,
        coords: null,
        errorType: "PERMISSION_DENIED",
        errorMessage: "Location permission is required to capture site proof photos.",
      };
    }
  }

  // Step 2: Check device location services (GPS switch)
  const servicesOn = await checkLocationServicesEnabled();
  if (!servicesOn) {
    return {
      success: false,
      coords: null,
      errorType: "SERVICES_DISABLED",
      errorMessage: "Please turn on your device location to send site photos.",
    };
  }

  // Step 3: Acquire GPS coordinates with timeout
  try {
    const locationPromise = Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    });

    const timeoutPromise = new Promise<null>((resolve) =>
      setTimeout(() => resolve(null), timeoutMs)
    );

    const position = await Promise.race([locationPromise, timeoutPromise]);

    if (position && position.coords) {
      return {
        success: true,
        coords: {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy ?? undefined,
        },
      };
    }

    // Fallback: check last known position if active fix took too long
    const lastKnown = await Location.getLastKnownPositionAsync().catch(() => null);
    if (lastKnown && lastKnown.coords) {
      return {
        success: true,
        coords: {
          latitude: lastKnown.coords.latitude,
          longitude: lastKnown.coords.longitude,
          accuracy: lastKnown.coords.accuracy ?? undefined,
        },
      };
    }

    return {
      success: false,
      coords: null,
      errorType: "TIMEOUT",
      errorMessage: "GPS signal acquisition timed out. Please ensure you are outdoors or in an open area and retry.",
    };
  } catch (err: any) {
    return {
      success: false,
      coords: null,
      errorType: "UNAVAILABLE",
      errorMessage: err?.message || "Could not obtain GPS coordinates.",
    };
  }
}

/**
 * Legacy wrapper for backward compatibility
 */
export async function captureLocation(): Promise<GPSLocation | null> {
  const result = await acquireAccurateGPS();
  return result.coords;
}
