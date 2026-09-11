import { Text, View } from "react-native";
import es from "../../i18n/es.json";

export default function Inicio() {
  return (
    <View style={{ flex: 1, padding: 16 }}>
      <Text style={{ fontSize: 20, fontWeight: "bold" }}>{es["Inicio"]}</Text>
      <Text>Meeting Base — designaciones · {es["Sala A"]}</Text>
    </View>
  );
}
