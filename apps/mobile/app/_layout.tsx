import { Stack } from "expo-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider, useAuth } from "../lib/auth";
import { ActivityIndicator, View } from "react-native";
import { useRouter, useSegments } from "expo-router";
import { useEffect } from "react";
import { ErrorBoundary } from "../components/ErrorBoundary";

const client = new QueryClient();

function AuthGuard() {
  const { user, isLoading } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) return;
    const inAuthGroup = segments[0] === "auth";
    if (!user && !inAuthGroup) {
      router.replace("/auth/login");
    } else if (user && inAuthGroup) {
      router.replace("/(tabs)");
    }
  }, [user, isLoading, segments]);

  return null;
}

function NotificationSetup() {
  const { user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!user) return;

    let cleanup: (() => void) | undefined;

    (async () => {
      try {
        const Constants = await import("expo-constants");
        const executionEnv = Constants.default?.executionEnvironment;
        if (executionEnv === "storeClient") return;

        const { registerForPushNotifications, setupNotificationListeners } = await import("../lib/notifications");
        await registerForPushNotifications();
        cleanup = await setupNotificationListeners(
          (_notification) => {},
          (response) => {
            const data = response.notification.request.content.data;
            if (data?.screen) {
              router.push(data.screen as string);
            }
          }
        );
      } catch {
        // Expo Go or error — skip notifications
      }
    })();

    return () => { cleanup?.(); };
  }, [user, router]);

  return null;
}

function AppContent() {
  const { isLoading } = useAuth();

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <>
      <AuthGuard />
      <NotificationSetup />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="auth/login" />
        <Stack.Screen name="auth/register" />
        <Stack.Screen name="(tabs)" />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={client}>
        <AuthProvider>
          <AppContent />
        </AuthProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}
