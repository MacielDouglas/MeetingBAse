import { View } from "react-native";
import { Tabs } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import es from "../../i18n/es.json";

export default function TabsLayout() {
  const insets = useSafeAreaInsets();

  return (
    <View style={{ flex: 1, paddingTop: insets.top }}>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: "#1a5276",
          tabBarInactiveTintColor: "#888",
          tabBarStyle: { paddingBottom: Math.max(insets.bottom, 4), height: 56 + insets.bottom },
          tabBarLabelStyle: { fontSize: 11, fontWeight: "600" },
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: es["Inicio"],
            tabBarIcon: ({ color, size }) => <Ionicons name="home" size={size} color={color} />,
          }}
        />
        <Tabs.Screen
          name="programa"
          options={{
            title: es["Reuniones"],
            tabBarIcon: ({ color, size }) => <Ionicons name="calendar" size={size} color={color} />,
          }}
        />
        <Tabs.Screen
          name="designacoes"
          options={{
            title: es["Designações"],
            tabBarIcon: ({ color, size }) => <Ionicons name="people" size={size} color={color} />,
          }}
        />
        <Tabs.Screen
          name="config"
          options={{
            title: es["Configuración"],
            tabBarIcon: ({ color, size }) => <Ionicons name="settings" size={size} color={color} />,
          }}
        />

        <Tabs.Screen name="asignar" options={{ href: null, title: es["Asignar"] }} />
        <Tabs.Screen name="importar" options={{ href: null, title: es["Importar"] }} />
        <Tabs.Screen name="publishers" options={{ href: null, title: es["Publicadores"] }} />
        <Tabs.Screen name="speakers" options={{ href: null, title: es["Oradores"] }} />
        <Tabs.Screen name="reportes" options={{ href: null, title: es["Reportes"] }} />
        <Tabs.Screen name="exportar" options={{ href: null, title: es["Exportar"] }} />
        <Tabs.Screen name="ausencias" options={{ href: null, title: es["Ausencias"] }} />
        <Tabs.Screen name="visits" options={{ href: null, title: es["Visitas"] }} />
        <Tabs.Screen name="profile" options={{ href: null, title: es["Perfil"] }} />
        <Tabs.Screen name="calendario" options={{ href: null, title: es["Calendario"] }} />
      </Tabs>
    </View>
  );
}
