import { Text, View } from "react-native";
import type { WeekSummary } from "../lib/api";
import es from "../i18n/es.json";

interface Props {
  weeks: WeekSummary[];
}

export function PreviewList({ weeks }: Props) {
  if (weeks.length === 0) {
    return <Text>{es["Sin semanas para mostrar"]}</Text>;
  }
  return (
    <>
      {weeks.map((item) => (
        <View
          key={item.index}
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
      ))}
    </>
  );
}
