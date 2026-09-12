import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export async function registerForPushNotifications(): Promise<string | null> {
  const { status: existing } = await Notifications.getPermissionsAsync();
  let final = existing;

  if (existing !== "granted") {
    const { status } = await Notifications.requestPermissionsAsync();
    final = status;
  }

  if (final !== "granted") return null;

  const token = await Notifications.getExpoPushTokenAsync();
  return token.data;
}

export async function scheduleLocalNotification(title: string, body: string, delay?: number) {
  await Notifications.scheduleNotificationAsync({
    content: { title, body, sound: true },
    trigger: delay ? { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: delay } : null,
  });
}

export function setupNotificationListeners(
  onReceive: (notification: Notifications.Notification) => void,
  onTapped: (response: Notifications.NotificationResponse) => void
) {
  const sub1 = Notifications.addNotificationReceivedListener(onReceive);
  const sub2 = Notifications.addNotificationResponseReceivedListener(onTapped);
  return () => {
    sub1.remove();
    sub2.remove();
  };
}
