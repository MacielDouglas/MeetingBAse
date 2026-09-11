import { FlatList, Text, View } from "react-native";
import type { WeekSummary } from "../lib/api";
import es from "../i18n/es.json";

interface Props {
  weeks: WeekSummary[];
}

// Lista de vista previa del import. Sala siempre A (sin selector).
export function PreviewList({ weeks }: Props) {
  if (weeks.length === 0) {
    return <Text>{es["Sin semanas para mostrar"]}</Text>;
  }
  return (
    <FlatList
      data={weeks}
      keyExtractor={(w) => String(w.index)}
      renderItem={({ item }) => (
        <View
          style={{ paddingVertical: 8, borderBottomWidth: 1, borderColor: "#ddd" }}
        >
          <Text style={{ fontWeight: "bold" }}>
            {item.semana} · {item.fecha}
          </Text>
          <Text>
            {item.lectura} · {item.parts_count} partes · {es["Sala fija"]}:{" "}
            {es["Sala A"]}
          </Text>
          {item.needs_review > 0 ? (
            <Text>
              {es["Requiere revisión"]}: {item.needs_review}
            </Text>
          ) : null}
        </View>
      )}
    />
  );
}
