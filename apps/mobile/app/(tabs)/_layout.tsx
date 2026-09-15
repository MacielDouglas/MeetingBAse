import { Text } from "react-native";
import { Tabs } from "expo-router";
import es from "../../i18n/es.json";

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: true,
        tabBarActiveTintColor: "#0a7ea4",
        tabBarInactiveTintColor: "#888",
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: es["Inicio"],
          tabBarIcon: ({ color }) => <TabIcon icon="\u{1F3E0}" color={color} />,
        }}
      />
      <Tabs.Screen
        name="programa"
        options={{
          title: es["Reuniones"],
          tabBarIcon: ({ color }) => <TabIcon icon="\u{1F4C5}" color={color} />,
        }}
      />
      <Tabs.Screen
        name="designacoes"
        options={{
          title: es["Designações"],
          tabBarIcon: ({ color }) => <TabIcon icon="\u{270D}\u{FE0F}" color={color} />,
        }}
      />
      <Tabs.Screen
        name="config"
        options={{
          title: es["Configuración"],
          tabBarIcon: ({ color }) => <TabIcon icon="\u{2699}\u{FE0F}" color={color} />,
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
  );
}

function TabIcon({ icon, color }: { icon: string; color: string }) {
  return <Text style={{ fontSize: 20, color }}>{icon}</Text>;
}
