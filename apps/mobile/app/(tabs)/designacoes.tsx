// Designações — Hub central com botões para todas as páginas de designação.
// Fase 30 — iOS + Android (Expo).

import { Text, View, TouchableOpacity, ScrollView } from "react-native";
import { useRouter } from "expo-router";
import es from "../../i18n/es.json";

interface HubItem {
  icon: string;
  title: string;
  route: "/(tabs)/importar" | "/(tabs)/asignar" | "/(tabs)/publishers" | "/(tabs)/speakers" | "/(tabs)/reportes" | "/(tabs)/exportar";
  color: string;
}

const HUB_ITEMS: HubItem[] = [
  { icon: "\u{1F4E4}", title: es["Importar"], route: "/(tabs)/importar", color: "#3498db" },
  { icon: "\u{270D}\u{FE0F}", title: es["Asignar"], route: "/(tabs)/asignar", color: "#27ae60" },
  { icon: "\u{1F465}", title: es["Publicadores"], route: "/(tabs)/publishers", color: "#8e44ad" },
  { icon: "\u{1F4CD}", title: es["Oradores"], route: "/(tabs)/speakers", color: "#e67e22" },
  { icon: "\u{1F4CA}", title: es["Reportes"], route: "/(tabs)/reportes", color: "#e74c3c" },
  { icon: "\u{1F4E5}", title: es["Exportar"], route: "/(tabs)/exportar", color: "#1abc9c" },
];

export default function Designacoes() {
  const router = useRouter();

  return (
    <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
      <Text style={{ fontSize: 20, fontWeight: "bold" }}>{es["Designações"]}</Text>
      <Text style={{ fontSize: 14, color: "#666" }}>Acceda a las diferentes secciones</Text>

      <View style={{ gap: 10, marginTop: 8 }}>
        {HUB_ITEMS.map((item) => (
          <TouchableOpacity
            key={item.route}
            onPress={() => router.push(item.route)}
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 14,
              padding: 16,
              backgroundColor: "#fff",
              borderRadius: 12,
              borderWidth: 1,
              borderColor: "#e0e0e0",
              shadowColor: "#000",
              shadowOffset: { width: 0, height: 1 },
              shadowOpacity: 0.05,
              shadowRadius: 3,
              elevation: 2,
            }}
          >
            <View
              style={{
                width: 44,
                height: 44,
                borderRadius: 10,
                backgroundColor: item.color + "18",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Text style={{ fontSize: 20 }}>{item.icon}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 16, fontWeight: "600", color: "#333" }}>{item.title}</Text>
            </View>
            <Text style={{ fontSize: 18, color: "#ccc" }}>{">"}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </ScrollView>
  );
}
