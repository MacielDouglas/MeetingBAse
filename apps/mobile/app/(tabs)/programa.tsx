import { useState } from "react";
import { Button, ScrollView, Text, View } from "react-native";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../../lib/auth";
import { getCongregationId, isNetworkError, publishMeeting } from "../../lib/api";
import { usePrograma } from "../../hooks/usePrograma";
import { makePubNameResolver, usePublishers } from "../../hooks/usePublishers";
import { SkeletonRow } from "../../components/Skeleton";
import es from "../../i18n/es.json";

function estadoLabel(estado: string): string {
  return estado === "published" ? es["Publicado"] : es["Borrador"];
}

function excepcionLabel(ex: string): string {
  switch (ex) {
    case "convencao": return "🏠 " + es["Convenção"];
    case "sin_reunion": return "🚫 " + es["Sin reunión"];
    case "convencao_virtual": return "💻 " + es["Convenção virtual"];
    default: return ex;
  }
}

function salaColor(sala: string): string {
  switch (sala) {
    case "A": return "#1a5276";
    case "B": return "#7d3c98";
    case "C": return "#27ae60";
    default: return "#666";
  }
}

export default function Programa() {
  const { user } = useAuth();
  const congId = user ? getCongregationId() : null;
  const { meetings, offline, lastSync, isPending, isError, error, refetch, isFetching } =
    usePrograma(congId);
  const { data: publishers } = usePublishers(congId);
  const pubName = makePubNameResolver(publishers ?? []);
  const client = useQueryClient();
  const [expanded, setExpanded] = useState<string | null>(null);
  const [publishMsg, setPublishMsg] = useState<string | null>(null);

  const pub = useMutation({
    mutationFn: async (meetingId: string) => {
      if (!congId) throw new Error(es["Sin conexión"]);
      return publishMeeting(congId, meetingId);
    },
    onSuccess: async () => {
      setPublishMsg(null);
      await client.invalidateQueries({ queryKey: ["programa", congId] });
    },
    onError: (e) => {
      setPublishMsg(
        isNetworkError(e) ? es["Necesitas conexión para asignar"] : (e as Error).message
      );
    },
  });

  const salas = new Set(meetings.flatMap((m) => m.parts.map((p) => p.sala)));

  return (
    <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
      <Text style={{ fontSize: 20, fontWeight: "bold" }}>{es["Programa"]}</Text>
      {salas.size > 1 ? (
        <Text style={{ fontSize: 12, color: "#7d3c98" }}>
          {es["Sala"]}: {[...salas].sort().map((s) => `${es["Sala"]} ${s}`).join(", ")}
        </Text>
      ) : (
        <Text style={{ fontSize: 12, color: "#666" }}>{es["Sala fija"]}: {es["Sala A"]}</Text>
      )}

      <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
        <Button
          title={isFetching ? es["Sincronizando..."] : es["Sincronizar"]}
          onPress={() => {
            setPublishMsg(null);
            refetch();
          }}
          disabled={isFetching}
        />
      </View>
      {offline ? <Text>{es["Sin conexión"]}</Text> : null}
      {lastSync && !offline ? (
        <Text>{es["Sincronizado"]}: {lastSync}</Text>
      ) : null}

      {isPending ? <SkeletonRow lines={5} /> : null}
      {isError && meetings.length === 0 ? (
        <Text>{(error as Error)?.message ?? es["Error al cargar el programa"]}</Text>
      ) : null}
      {!isPending && meetings.length === 0 ? (
        <Text>{es["Sin reuniones todavía"]}</Text>
      ) : null}
      {publishMsg ? <Text>{publishMsg}</Text> : null}

      {meetings.map((m) => {
        const open = expanded === m.id;
        const salasReuniao = new Set(m.parts.map((p) => p.sala));
        return (
          <View
            key={m.id}
            style={{ paddingVertical: 8, borderBottomWidth: 1, borderColor: "#ddd", gap: 4 }}
          >
            <Text style={{ fontWeight: "bold" }}>
              {m.semana_label ? `${m.semana_label} · ` : ""}
              {m.fecha}
              {m.hora_inicio ? ` · ${m.hora_inicio}` : ""}
            </Text>
            <Text>
              {m.tipo} · {[...salasReuniao].sort().join(", ")} · {m.parts.length} {es["partes"]} ·{" "}
              {estadoLabel(m.estado)}
            </Text>
            {m.excepcion ? (
              <Text style={{ color: "#e67e22", fontWeight: "bold" }}>
                {excepcionLabel(m.excepcion)}
              </Text>
            ) : null}
            {m.visita_co ? (
              <Text style={{ color: "#3498db", fontWeight: "bold" }}>
                👔 {es["Visita del CO"]}
              </Text>
            ) : null}
            {m.lectura_semanal ? <Text>{m.lectura_semanal}</Text> : null}
            {m.titulo_atalaya ? <Text>{m.titulo_atalaya}</Text> : null}
            {m.prayers.length > 0 ? (
              <Text>
                {m.prayers
                  .map(
                    (pr) =>
                      `${pr.tipo === "final" ? es["Oración final"] : es["Oración inicial"]}: ${
                        pr.publisher_id ? pubName(pr.publisher_id) : es["Sin asignar"]
                      }`
                  )
                  .join(" · ")}
              </Text>
            ) : null}
            <View style={{ flexDirection: "row", gap: 8 }}>
              <Button
                title={open ? es["Ocultar partes"] : es["Ver partes"]}
                onPress={() => setExpanded(open ? null : m.id)}
              />
              {m.estado !== "published" ? (
                <Button
                  title={pub.isPending ? es["Publicando..."] : es["Publicar"]}
                  onPress={() => pub.mutate(m.id)}
                  disabled={pub.isPending || offline}
                />
              ) : null}
            </View>
            {open
              ? m.parts.map((p) => (
                  <View key={p.id} style={{ paddingLeft: 12, paddingVertical: 4, gap: 2 }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                      <View style={{ backgroundColor: salaColor(p.sala), borderRadius: 4, paddingHorizontal: 4, paddingVertical: 1 }}>
                        <Text style={{ color: "#fff", fontSize: 10, fontWeight: "bold" }}>{p.sala}</Text>
                      </View>
                      <Text>
                        {p.hora_inicio ? `${p.hora_inicio}` : ""}
                        {p.hora_fin ? ` - ${p.hora_fin}` : ""}
                        {p.hora_inicio || p.hora_fin ? " · " : ""}
                        {p.orden}. {p.titulo}
                        {p.duracion_min ? ` (${p.duracion_min} min)` : ""}
                      </Text>
                    </View>
                    <Text style={{ paddingLeft: 20 }}>
                      {es["Titular"]}:{" "}
                      {p.titular_id ? pubName(p.titular_id) : es["Sin asignar"]}
                      {p.ayudante_id ? ` · ${es["Ayudante"]}: ${pubName(p.ayudante_id)}` : ""}
                    </Text>
                    {p.warnings.map((w) => (
                      <Text key={w.id} style={{ paddingLeft: 20 }}>⚠ {w.mensaje_es}</Text>
                    ))}
                  </View>
                ))
              : null}
          </View>
        );
      })}
    </ScrollView>
  );
}
