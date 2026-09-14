// Asignar (Fase 4A): designar com picker de publicadores.
// Online-only (POST /assign na API). Warnings suaves em espanhol.

import { useState } from "react";
import { Button, FlatList, ScrollView, Text, View } from "react-native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth, getCongregationId } from "../../lib/auth";
import es from "../../i18n/es.json";
import {
  assignPart,
  getPrayers,
  getPublisherHistory,
  getUnavailability,
  isNetworkError,
  savePrayer,
  suggestCandidates,
  type AssignResult,
  type PublisherHistory,
  type SyncPrayer,
} from "../../lib/api";
import { usePrograma } from "../../hooks/usePrograma";
import { usePublishers } from "../../hooks/usePublishers";

export default function Asignar() {
  const { user, token } = useAuth();
  const congId = getCongregationId(user);
  const { meetings, offline } = usePrograma(congId);
  const client = useQueryClient();
  const [meetingId, setMeetingId] = useState<string | null>(null);
  const [partId, setPartId] = useState<string | null>(null);
  const [titularId, setTitularId] = useState<string | null>(null);
  const [ayudanteId, setAyudanteId] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [result, setResult] = useState<AssignResult | null>(null);
  const [prayerSel, setPrayerSel] = useState<{ inicial: string | null; final: string | null }>({
    inicial: null,
    final: null,
  });
  const [prayerMsg, setPrayerMsg] = useState<string | null>(null);
  const [suggestMsg, setSuggestMsg] = useState<string | null>(null);

  const meeting = meetings.find((m) => m.id === meetingId) ?? null;
  const part = meeting?.parts.find((p) => p.id === partId) ?? null;

  const pubs = usePublishers(congId, token);
  const publishers = pubs.data ?? [];

  // Indisponíveis na data da reunião: fora dos pickers (a API também avisa).
  const unav = useQuery({
    queryKey: ["unavailability", congId, meeting?.fecha],
    queryFn: () => getUnavailability(congId, { fecha: meeting?.fecha }),
    enabled: !!congId && !!meeting?.fecha && !offline,
    retry: 1,
    staleTime: 30_000,
  });
  const unavIds = new Set((unav.data ?? []).map((u) => u.publisher_id));
  const available = publishers.filter((p) => !unavIds.has(p.id));

  // Oraciones actuales: del servidor si hay red, si no del sync local.
  const serverPrayers = useQuery({
    queryKey: ["prayers", congId, meetingId],
    queryFn: () => getPrayers(congId, meetingId as string),
    enabled: !!congId && !!meetingId && !offline,
    retry: 1,
    staleTime: 30_000,
  });
  const prayers: SyncPrayer[] =
    serverPrayers.data ??
    ((meeting?.prayers ?? []).map((p) => ({
      id: p.id,
      meeting_id: meetingId as string,
      tipo: p.tipo as "inicial" | "final",
      publisher_id: p.publisher_id,
    })) as SyncPrayer[]);

  const prayerMut = useMutation({
    mutationFn: (input: { tipo: "inicial" | "final"; publisher_id: string | null }) =>
      savePrayer(congId, meetingId as string, input),
    onSuccess: async () => {
      setPrayerMsg(es["Oración guardada"]);
      await client.invalidateQueries({ queryKey: ["prayers", congId, meetingId] });
      await client.invalidateQueries({ queryKey: ["programa", congId] });
    },
    onError: (e) => {
      setPrayerMsg((e as Error).message);
    },
  });

  function prayerName(tipo: "inicial" | "final"): string {
    const pr = prayers.find((p) => p.tipo === tipo);
    if (!pr?.publisher_id) return es["Sin asignar"];
    return getPubName(pr.publisher_id);
  }

  const mut = useMutation({    mutationFn: () =>
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
      const msg = (e as Error).message;
      if (isNetworkError(e)) {
        setFormError(es["Necesitas conexión para asignar"]);
      } else if (/no encontrada/i.test(msg)) {
        // Parte com ID antigo (lista local desatualizada): re-sincroniza
        // para limpar e mostra dica.
        setFormError(`${msg} — sincronice el Programa e intente de nuevo`);
        client.invalidateQueries({ queryKey: ["programa", congId] });
      } else {
        setFormError(msg);
      }
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

  // Fase 13: sugestão automática de titular + historial do selecionado.
  const suggest = useMutation({
    mutationFn: () => suggestCandidates(congId, partId as string),
    onSuccess: (list) => {
      if (list.length === 0) {
        setSuggestMsg(es["Sin candidatos"]);
        return;
      }
      setTitularId(list[0].id);
      setSuggestMsg(list.slice(0, 3).map((c) => `${c.nombre} (${c.motivo})`).join(" · "));
    },
    onError: (e) => {
      setSuggestMsg((e as Error).message);
    },
  });

  const history = useQuery({
    queryKey: ["history", congId, titularId],
    queryFn: () => getPublisherHistory(congId, titularId as string),
    enabled: !!congId && !!titularId && !offline,
    retry: 1,
    staleTime: 30_000,
  });
  const hist: PublisherHistory | undefined = history.data;

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
          <Button
            title={suggest.isPending ? es["Sugiriendo..."] : es["Sugerir"]}
            onPress={() => {
              setSuggestMsg(null);
              suggest.mutate();
            }}
            disabled={suggest.isPending || offline}
          />
          {suggestMsg ? (
            <Text style={{ fontSize: 12, color: "#666" }}>{suggestMsg}</Text>
          ) : null}
          <FlatList
            data={available}
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
              {hist ? ` · ${hist.total} designaciones${hist.last_fecha ? `, última: ${hist.last_fecha}` : ""}` : ""}
            </Text>
          ) : null}

          <Text style={{ fontWeight: "bold" }}>{es["Ayudante opcional"]}</Text>
          <FlatList
            data={available.filter((p) => p.id !== titularId)}
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

      {meeting ? (
        <View style={{ gap: 8, marginTop: 8 }}>
          <Text style={{ fontWeight: "bold" }}>Oraciones</Text>
          {(["inicial", "final"] as const).map((tipo) => (
            <View key={tipo} style={{ gap: 4 }}>
              <Text>
                {tipo === "final" ? es["Oración final"] : es["Oración inicial"]}:{" "}
                {prayerName(tipo)}
              </Text>
              <FlatList
                data={available}
                keyExtractor={(item) => `${tipo}-${item.id}`}
                horizontal
                showsHorizontalScrollIndicator={false}
                renderItem={({ item }) => (
                  <Button
                    title={item.nombre}
                    onPress={() => setPrayerSel((s) => ({ ...s, [tipo]: item.id }))}
                    color={prayerSel[tipo] === item.id ? "#1a5276" : "#ccc"}
                  />
                )}
              />
              <Button
                title={prayerMut.isPending ? es["Asignando..."] : es["Guardar oración"]}
                onPress={() =>
                  prayerMut.mutate({ tipo, publisher_id: prayerSel[tipo] })
                }
                disabled={prayerMut.isPending || offline || !prayerSel[tipo]}
              />
            </View>
          ))}
          {prayerMsg ? <Text>{prayerMsg}</Text> : null}
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
