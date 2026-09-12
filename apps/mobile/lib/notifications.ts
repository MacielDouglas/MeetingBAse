// Notifications module: lazy-loaded to avoid Expo Go push crash (SDK 53+).
// Push only works in development builds, not Expo Go.
// All functions are safe to call in Expo Go — they silently no-op.

let Notifications: typeof import("expo-notifications") | null = null;
let isExpoGo = false;

async function getNotifications() {
  if (Notifications) return Notifications;
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
    return Notifications;
  } catch {
    isExpoGo = true;
    return null;
  }
}

export async function registerForPushNotifications(): Promise<string | null> {
  const N = await getNotifications();
  if (!N || isExpoGo) return null;

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
    isExpoGo = true;
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
  if (!N || isExpoGo) return;

  try {
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
  } catch {
    // silently fail in Expo Go
  }
}

export async function scheduleMeetingReminder(
  meetingDate: string,
  semanaLabel: string | null,
  daysBefore: number = 1
) {
  const N = await getNotifications();
  if (!N || isExpoGo) return;

  const date = new Date(meetingDate + "T09:00:00");
  date.setDate(date.getDate() - daysBefore);
  const now = new Date();
  if (date <= now) return;

  const secondsUntil = Math.floor((date.getTime() - now.getTime()) / 1000);
  const title = "Reunión mañana";
  const body = semanaLabel
    ? `Reunión programada: ${semanaLabel}`
    : "Reunión programada para mañana";

  try {
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
  } catch {
    // silently fail in Expo Go
  }
}

export async function scheduleAssignmentReminder(
  partTitle: string,
  meetingDate: string,
  hoursBefore: number = 2
) {
  const N = await getNotifications();
  if (!N || isExpoGo) return;

  const date = new Date(meetingDate + "T18:00:00");
  date.setHours(date.getHours() - hoursBefore);
  const now = new Date();
  if (date <= now) return;

  const secondsUntil = Math.floor((date.getTime() - now.getTime()) / 1000);

  try {
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
  } catch {
    // silently fail in Expo Go
  }
}

export async function cancelAllNotifications() {
  const N = await getNotifications();
  if (!N || isExpoGo) return;
  try {
    await N.cancelAllScheduledNotificationsAsync();
  } catch {
    // silently fail
  }
}

export async function setupNotificationListeners(
  onReceive: (notification: { request: { content: { data?: Record<string, unknown> } } }) => void,
  onTapped: (response: { notification: { request: { content: { data?: Record<string, unknown> } } } }) => void
): Promise<() => void> {
  const N = await getNotifications();
  if (!N || isExpoGo) return () => {};

  // addNotificationReceivedListener / addNotificationResponseReceivedListener
  // may not exist in Expo Go SDK 53+ (push removed)
  try {
    if (typeof N.addNotificationReceivedListener !== "function") return () => {};
    if (typeof N.addNotificationResponseReceivedListener !== "function") return () => {};

    const sub1 = N.addNotificationReceivedListener(onReceive as (n: import("expo-notifications").Notification) => void);
    const sub2 = N.addNotificationResponseReceivedListener(onTapped as (r: import("expo-notifications").NotificationResponse) => void);
    return () => {
      sub1.remove();
      sub2.remove();
    };
  } catch {
    return () => {};
  }
}
