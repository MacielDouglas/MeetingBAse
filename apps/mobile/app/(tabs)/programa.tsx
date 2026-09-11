import { Text, View } from "react-native";
import es from "../../i18n/es.json";

// Programa local (SQLite lectura offline en Fase 2). Placeholder Fase 1.
export default function Programa() {
  return (
    <View style={{ flex: 1, padding: 16 }}>
      <Text style={{ fontSize: 20, fontWeight: "bold" }}>{es["Programa"]}</Text>
      <Text>{es["Sala A"]}</Text>
      <Text>{es["Necesitas conexión para asignar"]}</Text>
    </View>
  );
}
