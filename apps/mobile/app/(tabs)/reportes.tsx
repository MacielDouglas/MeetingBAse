// Reportes — resumen de designaciones por período (iOS + Android).

import { useState, useMemo } from "react";
import { Text, View, ScrollView, TouchableOpacity } from "react-native";
import { useRouter } from "expo-router";
import { usePrograma } from "../../hooks/usePrograma";
import { getCongregationId } from "../../lib/api";
import { usePublishers } from "../../hooks/usePublishers";
import es from "../../i18n/es.json";

type Periodo = "mes" | "3meses" | "ano";

function fechaCorte(p: Periodo): string {
  const now = new Date();
  if (p === "mes") now.setMonth(now.getMonth() - 1);
  else if (p === "3meses") now.setMonth(now.getMonth() - 3);
  else now.setFullYear(now.getFullYear() - 1);
  return now.toISOString().slice(0, 10);
}

export default function Reportes() {
  const router = useRouter();
  const congId = getCongregationId();
  const { meetings } = usePrograma(congId);
  const pubs = usePublishers(congId);
  const publishers = pubs.data ?? [];
  const [periodo, setPeriodo] = useState<Periodo>("mes");

  const corte = fechaCorte(periodo);
  const filtered = useMemo(() => meetings.filter((m) => m.fecha >= corte), [meetings, corte]);

  const stats = useMemo(() => {
    const pubMap = new Map<string, { nombre: string; titular: number; ayudante: number }>();
    const pubLookup = new Map(publishers.map((p) => [p.id, p.nombre]));
    for (const m of filtered) {
      for (const p of m.parts) {
        if (p.titular_id) {
          const nombre = pubLookup.get(p.titular_id) ?? "???";
          const entry = pubMap.get(p.titular_id) ?? { nombre, titular: 0, ayudante: 0 };
          entry.titular++;
          pubMap.set(p.titular_id, entry);
        }
        if (p.ayudante_id) {
          const nombre = pubLookup.get(p.ayudante_id) ?? "???";
          const entry = pubMap.get(p.ayudante_id) ?? { nombre, titular: 0, ayudante: 0 };
          entry.ayudante++;
          pubMap.set(p.ayudante_id, entry);
        }
      }
    }
    return [...pubMap.entries()]
      .map(([id, s]) => ({ id, ...s, total: s.titular + s.ayudante }))
      .sort((a, b) => b.total - a.total);
  }, [filtered, publishers]);

  const sinAsignar = useMemo(() => {
    let count = 0;
    for (const m of filtered) {
      for (const p of m.parts) {
        if (!p.titular_id && p.tipo_clave !== "cancion") count++;
      }
    }
    return count;
  }, [filtered]);

  const publishRate = useMemo(() => {
    const total = filtered.filter((m) => m.estado === "publicada").length;
    return filtered.length > 0 ? Math.round((total / filtered.length) * 100) : 0;
  }, [filtered]);

  return (
    <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
        <TouchableOpacity onPress={() => router.back()} style={{ padding: 8 }}>
          <Text style={{ fontSize: 18 }}>{es["Volver"]}</Text>
        </TouchableOpacity>
        <Text style={{ fontSize: 20, fontWeight: "bold" }}>{es["Reportes"]}</Text>
      </View>

      {/* Selector período */}
      <View style={{ flexDirection: "row", gap: 8 }}>
        {(["mes", "3meses", "ano"] as const).map((p) => (
          <TouchableOpacity
            key={p}
            onPress={() => setPeriodo(p)}
            style={{ flex: 1, padding: 8, borderRadius: 6, alignItems: "center", backgroundColor: periodo === p ? "#0a7ea4" : "#eee" }}
          >
            <Text style={{ color: periodo === p ? "#fff" : "#333", fontWeight: "600" }}>
              {p === "mes" ? es["Este mes"] : p === "3meses" ? es["Últimos 3 meses"] : es["Último año"]}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Resumen */}
      <View style={{ flexDirection: "row", gap: 8 }}>
        <View style={{ flex: 1, padding: 10, backgroundColor: "#eaf2f8", borderRadius: 8, alignItems: "center" }}>
          <Text style={{ fontSize: 24, fontWeight: "bold", color: "#0a7ea4" }}>{filtered.length}</Text>
          <Text style={{ fontSize: 12, color: "#666" }}>{es["Reuniones"]}</Text>
        </View>
        <View style={{ flex: 1, padding: 10, backgroundColor: "#eaf2f8", borderRadius: 8, alignItems: "center" }}>
          <Text style={{ fontSize: 24, fontWeight: "bold", color: "#27ae60" }}>{publishRate}%</Text>
          <Text style={{ fontSize: 12, color: "#666" }}>{es["Publicadas"]}</Text>
        </View>
        <View style={{ flex: 1, padding: 10, backgroundColor: "#eaf2f8", borderRadius: 8, alignItems: "center" }}>
          <Text style={{ fontSize: 24, fontWeight: "bold", color: "#e74c3c" }}>{sinAsignar}</Text>
          <Text style={{ fontSize: 12, color: "#666" }}>{es["Sin asignar"]}</Text>
        </View>
      </View>

      {/* Top publicadores */}
      <Text style={{ fontWeight: "bold", fontSize: 14, color: "#555" }}>
        {es["Publicadores"]} ({stats.length})
      </Text>
      {stats.length === 0 ? <Text style={{ color: "#888" }}>{es["Sin datos"]}</Text> : null}
      {stats.map((s, i) => (
        <View key={s.id} style={{ flexDirection: "row", padding: 8, backgroundColor: i % 2 === 0 ? "#fff" : "#f9f9f9", borderRadius: 6, gap: 8 }}>
          <Text style={{ width: 24, fontWeight: "bold", color: "#888", textAlign: "center" }}>{i + 1}</Text>
          <View style={{ flex: 1 }}>
            <Text style={{ fontWeight: "600" }}>{s.nombre}</Text>
            <Text style={{ fontSize: 12, color: "#666" }}>
              {s.titular}× titular · {s.ayudante}× ayudante
            </Text>
          </View>
          <Text style={{ fontWeight: "bold", color: "#0a7ea4", alignSelf: "center" }}>{s.total}</Text>
        </View>
      ))}
    </ScrollView>
  );
}
