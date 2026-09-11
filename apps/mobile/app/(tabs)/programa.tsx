import { ScrollView, Text, View } from "react-native";
import { useQuery } from "@tanstack/react-query";
import es from "../../i18n/es.json";
import { CONGREGATION_ID, getMeetings } from "../../lib/api";

// Programa (Fase 2A): lee GET /meetings via TanStack Query.
// Sala siempre A, sin selector. Sin conexion muestra aviso offline.
// Funciona igual en iOS y Android (solo fetch, sin nativos).
export default function Programa() {
  const query = useQuery({
    queryKey: ["meetings", CONGREGATION_ID],
    queryFn: () => getMeetings(CONGREGATION_ID),
    retry: 1,
  });

  const meetings = query.data?.meetings ?? [];

  return (
    <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
      <Text style={{ fontSize: 20, fontWeight: "bold" }}>{es["Programa"]}</Text>
      <Text>
        {es["Sala fija"]}: {es["Sala A"]}
      </Text>

      {query.isPending ? <Text>{es["Cargando programa..."]}</Text> : null}

      {query.isError ? (
        <Text>
          {es["Necesitas conexión para asignar"]}
        </Text>
      ) : null}

      {!query.isPending && !query.isError && meetings.length === 0 ? (
        <Text>{es["Sin reuniones todavía"]}</Text>
      ) : null}

      {meetings.map((m) => (
        <View
          key={m.id}
          style={{ paddingVertical: 8, borderBottomWidth: 1, borderColor: "#ddd" }}
        >
          <Text style={{ fontWeight: "bold" }}>
            {m.semana_label ? `${m.semana_label} · ` : ""}
            {m.fecha}
          </Text>
          <Text>
            {m.tipo} · {es["Sala A"]} · {m.parts_count} {es["partes"]}
          </Text>
        </View>
      ))}
    </ScrollView>
  );
}
