import axios from "axios";

export async function sendPushNotification(
  expoPushToken: string,
  title: string,
  body: string,
  data?: any
): Promise<boolean> {
  if (!expoPushToken || !expoPushToken.startsWith("ExponentPushToken")) {
    console.warn("Invalid expo push token:", expoPushToken);
    return false;
  }

  try {
    const message = {
      to: expoPushToken,
      sound: "default",
      title: title,
      body: body,
      data: data || {},
    };

    const response = await axios.post("https://exp.host/--/api/v2/push/send", message, {
      headers: {
        Accept: "application/json",
        "Accept-encoding": "gzip, deflate",
        "Content-Type": "application/json",
      },
    });

    return response.status === 200;
  } catch (error) {
    console.error("Error sending push notification:", error);
    return false;
  }
}
