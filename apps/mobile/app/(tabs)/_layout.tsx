import { Tabs } from "expo-router";
import es from "../../i18n/es.json";

// Tabs: Inicio / Programa / Asignar / Importar. Textos en español.
export default function TabsLayout() {
  return (
    <Tabs screenOptions={{ headerShown: true }}>
      <Tabs.Screen name="index" options={{ title: es["Inicio"] }} />
      <Tabs.Screen name="programa" options={{ title: es["Programa"] }} />
      <Tabs.Screen name="asignar" options={{ title: es["Asignar"] }} />
      <Tabs.Screen name="importar" options={{ title: es["Importar"] }} />
    </Tabs>
  );
}
