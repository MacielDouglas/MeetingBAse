// Notifications module: lazy-loaded to avoid Expo Go push crash (SDK 53+).
// Push only works in development builds, not Expo Go.

let Notifications: typeof import("expo-notifications") | null = null;

async function getNotifications() {
  if (!Notifications) {
    try {
      Notifications = await import("expo-notifications");
      Notifications.setNotificationHandler({
        handleNotification: async () => ({
          shouldShowAlert: true,
          shouldShowBanner: true,
          shouldShowList: true,
          shouldPlaySound: true,
          shouldSetBadge: false,
        }),
      });
    } catch {
      return null;
    }
  }
  return Notifications;
}

export async function registerForPushNotifications(): Promise<string | null> {
  const N = await getNotifications();
  if (!N) return null;

  try {
    const { status: existing } = await N.getPermissionsAsync();
    let finalStatus = existing;

    if (existing !== "granted") {
      const { status } = await N.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== "granted") return null;

    const { Platform } = await import("react-native");
    if (Platform.OS === "android") {
      await N.setNotificationChannelAsync("meetings", {
        name: "Reuniones",
        importance: N.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
      });
      await N.setNotificationChannelAsync("assignments", {
        name: "Designaciones",
        importance: N.AndroidImportance.DEFAULT,
      });
    }

    const token = await N.getExpoPushTokenAsync();
    return token.data;
  } catch {
    // Expo Go: push not supported, fail silently
    return null;
  }
}

export async function scheduleLocalNotification(
  title: string,
  body: string,
  delay?: number,
  channelId?: string
) {
  const N = await getNotifications();
  if (!N) return;

  await N.scheduleNotificationAsync({
    content: {
      title,
      body,
      sound: true,
      ...(channelId ? { channelId } : {}),
    },
    trigger: delay
      ? { type: N.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: delay }
      : null,
  });
}

export async function scheduleMeetingReminder(
  meetingDate: string,
  semanaLabel: string | null,
  daysBefore: number = 1
) {
  const N = await getNotifications();
  if (!N) return;

  const date = new Date(meetingDate + "T09:00:00");
  date.setDate(date.getDate() - daysBefore);
  const now = new Date();
  if (date <= now) return;

  const secondsUntil = Math.floor((date.getTime() - now.getTime()) / 1000);
  const title = "Reunión mañana";
  const body = semanaLabel
    ? `Reunión programada: ${semanaLabel}`
    : "Reunión programada para mañana";

  const { Platform } = await import("react-native");
  await N.scheduleNotificationAsync({
    content: {
      title,
      body,
      sound: true,
      ...(Platform.OS === "android" ? { channelId: "meetings" } : {}),
    },
    trigger: {
      type: N.SchedulableTriggerInputTypes.TIME_INTERVAL,
      seconds: secondsUntil,
    },
  });
}

export async function scheduleAssignmentReminder(
  partTitle: string,
  meetingDate: string,
  hoursBefore: number = 2
) {
  const N = await getNotifications();
  if (!N) return;

  const date = new Date(meetingDate + "T18:00:00");
  date.setHours(date.getHours() - hoursBefore);
  const now = new Date();
  if (date <= now) return;

  const secondsUntil = Math.floor((date.getTime() - now.getTime()) / 1000);

  const { Platform } = await import("react-native");
  await N.scheduleNotificationAsync({
    content: {
      title: "Designación pendiente",
      body: `Prepárate para: ${partTitle}`,
      sound: true,
      ...(Platform.OS === "android" ? { channelId: "assignments" } : {}),
    },
    trigger: {
      type: N.SchedulableTriggerInputTypes.TIME_INTERVAL,
      seconds: secondsUntil,
    },
  });
}

export async function cancelAllNotifications() {
  const N = await getNotifications();
  if (!N) return;
  await N.cancelAllScheduledNotificationsAsync();
}

export async function setupNotificationListeners(
  onReceive: (notification: { request: { content: { data?: Record<string, unknown> } } }) => void,
  onTapped: (response: { notification: { request: { content: { data?: Record<string, unknown> } } } }) => void
): Promise<() => void> {
  const N = await getNotifications();
  if (!N) return () => {};

  const sub1 = N.addNotificationReceivedListener(onReceive as (n: import("expo-notifications").Notification) => void);
  const sub2 = N.addNotificationResponseReceivedListener(onTapped as (r: import("expo-notifications").NotificationResponse) => void);
  return () => {
    sub1.remove();
    sub2.remove();
  };
}
