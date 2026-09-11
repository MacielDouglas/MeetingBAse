// Asignar (Fase 3): designar exige online (POST /assign en la API).
// Sin endpoint de publishers: titular/ayudante se informan como UUID
// (temporal hasta auth/congregación real). Warnings suaves en español,
// errores 422 en español. Tras éxito revalida el sync (programa).

import { useState } from "react";
import { Button, ScrollView, Text, TextInput, View } from "react-native";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import es from "../../i18n/es.json";
import {
  CONGREGATION_ID,
  assignPart,
  isNetworkError,
  isUuid,
  type AssignResult,
} from "../../lib/api";
import { usePrograma } from "../../hooks/usePrograma";

export default function Asignar() {
  const { meetings, offline } = usePrograma();
  const client = useQueryClient();
  const [meetingId, setMeetingId] = useState<string | null>(null);
  const [partId, setPartId] = useState<string | null>(null);
  const [titular, setTitular] = useState("");
  const [ayudante, setAyudante] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [result, setResult] = useState<AssignResult | null>(null);

  const meeting = meetings.find((m) => m.id === meetingId) ?? null;
  const part = meeting?.parts.find((p) => p.id === partId) ?? null;

  const mut = useMutation({
    mutationFn: () =>
      assignPart(CONGREGATION_ID, partId as string, {
        titular_id: titular,
        ayudante_id: ayudante.trim() ? ayudante : null,
      }),
    onSuccess: async (data) => {
      setResult(data);
      setFormError(null);
      await client.invalidateQueries({ queryKey: ["programa", CONGREGATION_ID] });
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
    if (!isUuid(titular)) {
      setFormError(es["Titular inválido"]);
      return;
    }
    if (ayudante.trim() && !isUuid(ayudante)) {
      setFormError(es["Ayudante inválido"]);
      return;
    }
    mut.mutate();
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
          <Text>{es["Titular (UUID)"]}</Text>
          <TextInput
            value={titular}
            onChangeText={setTitular}
            placeholder="00000000-0000-0000-0000-000000000000"
            autoCapitalize="none"
            autoCorrect={false}
            style={{ borderWidth: 1, borderColor: "#ccc", padding: 8, borderRadius: 4 }}
          />
          <Text>{es["Ayudante opcional (UUID)"]}</Text>
          <TextInput
            value={ayudante}
            onChangeText={setAyudante}
            placeholder="UUID"
            autoCapitalize="none"
            autoCorrect={false}
            style={{ borderWidth: 1, borderColor: "#ccc", padding: 8, borderRadius: 4 }}
          />
          <Button
            title={mut.isPending ? es["Asignando..."] : es["Asignar"]}
            onPress={enviar}
            disabled={mut.isPending || offline}
          />
        </View>
      ) : null}

      {formError ? <Text>{formError}</Text> : null}
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
