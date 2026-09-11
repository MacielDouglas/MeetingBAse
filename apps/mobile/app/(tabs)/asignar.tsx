// Asignar (Fase 4A): designar com picker de publicadores.
// Online-only (POST /assign na API). Warnings suaves em espanhol.

import { useState } from "react";
import { Button, FlatList, ScrollView, Text, View } from "react-native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth, authHeaders, getCongregationId } from "../../lib/auth";
import es from "../../i18n/es.json";
import {
  API_URL,
  assignPart,
  isNetworkError,
  type AssignResult,
} from "../../lib/api";
import { usePrograma } from "../../hooks/usePrograma";

interface Publisher {
  id: string;
  nombre: string;
  sexo: string;
  cargo: string;
}

export default function Asignar() {
  const { user, token } = useAuth();
  const congId = getCongregationId(user);
  const { meetings, offline } = usePrograma();
  const client = useQueryClient();
  const [meetingId, setMeetingId] = useState<string | null>(null);
  const [partId, setPartId] = useState<string | null>(null);
  const [titularId, setTitularId] = useState<string | null>(null);
  const [ayudanteId, setAyudanteId] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [result, setResult] = useState<AssignResult | null>(null);

  const meeting = meetings.find((m) => m.id === meetingId) ?? null;
  const part = meeting?.parts.find((p) => p.id === partId) ?? null;

  const pubs = useQuery({
    queryKey: ["publishers", congId],
    queryFn: async () => {
      const res = await fetch(`${API_URL}/c/${congId}/publishers`, {
        headers: authHeaders(token),
      });
      const body = await res.json();
      return (body.publishers ?? []) as Publisher[];
    },
  });

  const publishers = pubs.data ?? [];

  const mut = useMutation({
    mutationFn: () =>
      assignPart(congId, partId as string, {
        titular_id: titularId as string,
        ayudante_id: ayudanteId,
      }),
    onSuccess: async (data) => {
      setResult(data);
      setFormError(null);
      await client.invalidateQueries({ queryKey: ["programa", congId] });
    },
    onError: (e) => {
      setResult(null);
      setFormError(
        isNetworkError(e) ? es["Necesitas conexión para asignar"] : (e as Error).message
      );
    },
  });

  function enviar() {
    setFormError(null);
    setResult(null);
    if (offline) {
      setFormError(es["Necesitas conexión para asignar"]);
      return;
    }
    if (!meetingId || !partId) {
      setFormError(es["Selecciona reunión y parte"]);
      return;
    }
    if (!titularId) {
      setFormError("Seleccione un titular");
      return;
    }
    mut.mutate();
  }

  function getPubName(id: string | null): string {
    if (!id) return "";
    return publishers.find((p) => p.id === id)?.nombre ?? "Desconocido";
  }

  return (
    <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
      <Text style={{ fontSize: 20, fontWeight: "bold" }}>{es["Asignar"]}</Text>
      <Text>
        {es["Sala fija"]}: {es["Sala A"]}
      </Text>
      {offline ? <Text>{es["Necesitas conexión para asignar"]}</Text> : null}

      <Text style={{ fontWeight: "bold" }}>{es["Reunión"]}</Text>
      {meetings.length === 0 ? <Text>{es["Sin reuniones todavía"]}</Text> : null}
      {meetings.map((m) => (
        <Button
          key={m.id}
          title={`${m.semana_label ? `${m.semana_label} · ` : ""}${m.fecha} · ${m.tipo}`}
          onPress={() => {
            setMeetingId(m.id);
            setPartId(null);
            setTitularId(null);
            setAyudanteId(null);
            setResult(null);
          }}
          color={m.id === meetingId ? "#0a7ea4" : undefined}
        />
      ))}

      {meeting ? (
        <View style={{ gap: 8 }}>
          <Text style={{ fontWeight: "bold" }}>{es["Parte"]}</Text>
          {meeting.parts.map((p) => (
            <Button
              key={p.id}
              title={`${p.orden}. ${p.titulo}`}
              onPress={() => {
                setPartId(p.id);
                setTitularId(null);
                setAyudanteId(null);
                setResult(null);
              }}
              color={p.id === partId ? "#0a7ea4" : undefined}
            />
          ))}
        </View>
      ) : null}

      {part ? (
        <View style={{ gap: 8 }}>
          <Text style={{ fontWeight: "bold" }}>
            {part.orden}. {part.titulo}
          </Text>

          <Text style={{ fontWeight: "bold" }}>{es["Titular"]}</Text>
          <FlatList
            data={publishers}
            keyExtractor={(item) => item.id}
            horizontal
            showsHorizontalScrollIndicator={false}
            renderItem={({ item }) => (
              <Button
                title={item.nombre}
                onPress={() => setTitularId(item.id)}
                color={titularId === item.id ? "#1a5276" : "#ccc"}
              />
            )}
          />
          {titularId ? (
            <Text style={{ fontSize: 12, color: "#666" }}>
              Seleccionado: {getPubName(titularId)}
            </Text>
          ) : null}

          <Text style={{ fontWeight: "bold" }}>{es["Ayudante opcional"]}</Text>
          <FlatList
            data={publishers.filter((p) => p.id !== titularId)}
            keyExtractor={(item) => item.id}
            horizontal
            showsHorizontalScrollIndicator={false}
            renderItem={({ item }) => (
              <Button
                title={item.nombre}
                onPress={() => setAyudanteId(item.id)}
                color={ayudanteId === item.id ? "#7d3c98" : "#ccc"}
              />
            )}
          />
          {ayudanteId ? (
            <Text style={{ fontSize: 12, color: "#666" }}>
              Seleccionado: {getPubName(ayudanteId)}
              <Button title=" X" onPress={() => setAyudanteId(null)} color="#888" />
            </Text>
          ) : null}

          <Button
            title={mut.isPending ? es["Asignando..."] : es["Asignar"]}
            onPress={enviar}
            disabled={mut.isPending || offline}
          />
        </View>
      ) : null}

      {formError ? <Text style={{ color: "red" }}>{formError}</Text> : null}
      {result ? (
        <View style={{ gap: 4 }}>
          <Text style={{ fontWeight: "bold" }}>{es["Asignación guardada"]}</Text>
          {result.warnings.length === 0 ? <Text>{es["Sin avisos"]}</Text> : null}
          {result.warnings.map((w, i) => (
            <Text key={`${w.tipo}-${i}`}>⚠ {w.mensaje_es}</Text>
          ))}
        </View>
      ) : null}
    </ScrollView>
  );
}
