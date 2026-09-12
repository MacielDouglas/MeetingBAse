import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export async function registerForPushNotifications(): Promise<string | null> {
  const { status: existing } = await Notifications.getPermissionsAsync();
  let finalStatus = existing;

  if (existing !== "granted") {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== "granted") return null;

  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("meetings", {
      name: "Reuniones",
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
    });
    await Notifications.setNotificationChannelAsync("assignments", {
      name: "Designaciones",
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }

  const token = await Notifications.getExpoPushTokenAsync();
  return token.data;
}

export async function scheduleLocalNotification(
  title: string,
  body: string,
  delay?: number,
  channelId?: string
) {
  await Notifications.scheduleNotificationAsync({
    content: {
      title,
      body,
      sound: true,
      ...(channelId ? { channelId } : {}),
    },
    trigger: delay
      ? { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: delay }
      : null,
  });
}

export async function scheduleMeetingReminder(
  meetingDate: string,
  semanaLabel: string | null,
  daysBefore: number = 1
) {
  const date = new Date(meetingDate + "T09:00:00");
  date.setDate(date.getDate() - daysBefore);
  const now = new Date();
  if (date <= now) return;

  const secondsUntil = Math.floor((date.getTime() - now.getTime()) / 1000);
  const title = "Reunión mañana";
  const body = semanaLabel
    ? `Reunión programada: ${semanaLabel}`
    : "Reunión programada para mañana";

  await Notifications.scheduleNotificationAsync({
    content: {
      title,
      body,
      sound: true,
      ...(Platform.OS === "android" ? { channelId: "meetings" } : {}),
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
      seconds: secondsUntil,
    },
  });
}

export async function scheduleAssignmentReminder(
  partTitle: string,
  meetingDate: string,
  hoursBefore: number = 2
) {
  const date = new Date(meetingDate + "T18:00:00");
  date.setHours(date.getHours() - hoursBefore);
  const now = new Date();
  if (date <= now) return;

  const secondsUntil = Math.floor((date.getTime() - now.getTime()) / 1000);

  await Notifications.scheduleNotificationAsync({
    content: {
      title: "Designación pendiente",
      body: `Prepárate para: ${partTitle}`,
      sound: true,
      ...(Platform.OS === "android" ? { channelId: "assignments" } : {}),
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
      seconds: secondsUntil,
    },
  });
}

export async function cancelAllNotifications() {
  await Notifications.cancelAllScheduledNotificationsAsync();
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
