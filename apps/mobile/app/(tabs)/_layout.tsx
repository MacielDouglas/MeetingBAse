import { Tabs } from "expo-router";
import es from "../../i18n/es.json";

export default function TabsLayout() {
  return (
    <Tabs screenOptions={{ headerShown: true }}>
      <Tabs.Screen name="index" options={{ title: es["Inicio"] }} />
      <Tabs.Screen name="calendario" options={{ title: es["Calendario"] }} />
      <Tabs.Screen name="programa" options={{ title: es["Programa"] }} />
      <Tabs.Screen name="asignar" options={{ title: es["Asignar"] }} />
      <Tabs.Screen name="importar" options={{ title: es["Importar"] }} />
      <Tabs.Screen name="publishers" options={{ title: es["Publicadores"] }} />
      <Tabs.Screen name="ausencias" options={{ title: es["Ausencias"] }} />
      <Tabs.Screen name="speakers" options={{ title: es["Falantes"] }} />
      <Tabs.Screen name="visits" options={{ title: es["Visitas"] }} />
      <Tabs.Screen name="reportes" options={{ title: es["Reportes"] }} />
      <Tabs.Screen name="exportar" options={{ title: es["Exportar"] }} />
      <Tabs.Screen name="config" options={{ title: es["Configuración"] }} />
      <Tabs.Screen name="profile" options={{ title: es["Perfil"] }} />
    </Tabs>
  );
}
