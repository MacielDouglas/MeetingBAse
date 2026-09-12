import { Tabs } from "expo-router";
import { useTranslation } from "react-i18next";

export default function TabsLayout() {
  const { t } = useTranslation();
  return (
    <Tabs screenOptions={{ headerShown: true }}>
      <Tabs.Screen name="index" options={{ title: t("Inicio") }} />
      <Tabs.Screen name="programa" options={{ title: t("Programa") }} />
      <Tabs.Screen name="asignar" options={{ title: t("Asignar") }} />
      <Tabs.Screen name="importar" options={{ title: t("Importar") }} />
      <Tabs.Screen name="publishers" options={{ title: t("Publicadores") }} />
      <Tabs.Screen name="speakers" options={{ title: t("Falantes") }} />
      <Tabs.Screen name="visits" options={{ title: t("Visitas") }} />
      <Tabs.Screen name="exportar" options={{ title: t("Exportar") }} />
      <Tabs.Screen name="profile" options={{ title: t("Perfil") }} />
    </Tabs>
  );
}
