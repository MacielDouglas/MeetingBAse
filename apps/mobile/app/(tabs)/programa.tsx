// Programa (Fase 3): lee del SQLite via usePrograma (offline-first).
// Reuniones expandibles con parts, titular y warnings. Publicar exige online.
// Sala siempre A, sin selector. iOS + Android (sin nativos nuevos).

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

  return (
    <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
      <Text style={{ fontSize: 20, fontWeight: "bold" }}>{es["Programa"]}</Text>
      <Text>
        {es["Sala fija"]}: {es["Sala A"]}
      </Text>

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
        <Text>
          {es["Sincronizado"]}: {lastSync}
        </Text>
      ) : null}

      {isPending ? <SkeletonRow lines={5} /> : null}
      {isError && meetings.length === 0 ? (
        <Text>
          {(error as Error)?.message ?? es["Error al cargar el programa"]}
        </Text>
      ) : null}
      {!isPending && meetings.length === 0 ? (
        <Text>{es["Sin reuniones todavía"]}</Text>
      ) : null}
      {publishMsg ? <Text>{publishMsg}</Text> : null}

      {meetings.map((m) => {
        const open = expanded === m.id;
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
              {m.tipo} · {es["Sala A"]} · {m.parts.length} {es["partes"]} ·{" "}
              {estadoLabel(m.estado)}
            </Text>
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
                    <Text>
                      {p.hora_inicio ? `${p.hora_inicio} · ` : ""}
                      {p.orden}. {p.titulo}
                      {p.duracion_min ? ` (${p.duracion_min} min)` : ""}
                    </Text>
                    <Text>
                      {es["Titular"]}:{" "}
                      {p.titular_id ? pubName(p.titular_id) : es["Sin asignar"]}
                      {p.ayudante_id ? ` · ${es["Ayudante"]}: ${pubName(p.ayudante_id)}` : ""}
                    </Text>
                    {p.warnings.map((w) => (
                      <Text key={w.id}>⚠ {w.mensaje_es}</Text>
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
