// Asignar — fluxo: reunião → presidente → partes com filtros.
// Cânticos não são designáveis. Online-only.
// Componentes PresidentSection e PartCard em ../components/AsignarCards.tsx

import { useState, useMemo } from "react";
import { Button, FlatList, ScrollView, Text, View } from "react-native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import es from "../../i18n/es.json";
import {
  assignPart,
  getCongregationId,
  getPrayers,
  getUnavailability,
  isNetworkError,
  savePrayer,
  suggestCandidates,
  type SyncPrayer,
} from "../../lib/api";
import { fmtDate } from "../../lib/formatDate";
import { usePrograma } from "../../hooks/usePrograma";
import { usePublishers } from "../../hooks/usePublishers";
import { matchesFilter, PART_FILTERS, PresidentSection, PartCard } from "../../components/AsignarCards";

const SECTION_LABELS: Record<string, string> = {
  TESOROS: "Tesoros de la Palabra de Dios",
  MAESTROS: "Haz tu mejor ministerio",
  VIDA: "Nuestra vida cristiana",
  EBC: "Estudio Bíblico de la congregación",
  SENTINELA: "Sentinela",
  ATALAYA: "Estudio de la Atalaya",
};

export default function Asignar() {
  const congId = getCongregationId();
  const { meetings, offline } = usePrograma(congId);
  const client = useQueryClient();
  const [meetingId, setMeetingId] = useState<string | null>(null);
  const [expandedPart, setExpandedPart] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [result, setResult] = useState<{ warnings: { tipo: string; mensaje_es: string }[] } | null>(null);
  const [prayerSel, setPrayerSel] = useState<{ inicial: string | null; final: string | null }>({ inicial: null, final: null });
  const [prayerMsg, setPrayerMsg] = useState<string | null>(null);

  const meeting = meetings.find((m) => m.id === meetingId) ?? null;

  const pubs = usePublishers(congId);
  const publishers = pubs.data ?? [];

  const unav = useQuery({
    queryKey: ["unavailability", congId, meeting?.fecha],
    queryFn: () => getUnavailability(congId, { fecha: meeting?.fecha }),
    enabled: !!congId && !!meeting?.fecha && !offline,
    retry: 1,
    staleTime: 30_000,
  });
  const unavIds = new Set((unav.data ?? []).map((u) => u.publisher_id));
  const available = publishers.filter((p) => !unavIds.has(p.id));

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
    onError: (e) => setPrayerMsg((e as Error).message),
  });

  const presPart = meeting?.parts.find((p) => p.tipo_clave === "wk_presidente") ?? null;

  const assignableParts = useMemo(() => {
    if (!meeting) return [];
    return meeting.parts.filter((p) => {
      const sec = (p.seccion ?? "").toUpperCase();
      if (sec === "CANCION") return false;
      if (p.tipo_clave === "wk_presidente") return false;
      return true;
    });
  }, [meeting]);

  const grouped = useMemo(() => {
    const map = new Map<string, typeof assignableParts>();
    for (const p of assignableParts) {
      const sec = p.seccion ?? "OTROS";
      const list = map.get(sec) ?? [];
      list.push(p);
      map.set(sec, list);
    }
    return map;
  }, [assignableParts]);

  // ── Auto-asignar todas ──
  const [autoAssignResult, setAutoAssignResult] = useState<string | null>(null);
  const autoAssignMut = useMutation({
    mutationFn: async () => {
      if (!meeting) return;
      let assigned = 0;
      let skipped = 0;
      for (const p of assignableParts) {
        if (p.titular_id) { skipped++; continue; }
        try {
          const candidates = await suggestCandidates(congId, p.id);
          if (candidates.length === 0) { skipped++; continue; }
          await assignPart(congId, p.id, { titular_id: candidates[0].id, ayudante_id: null });
          assigned++;
        } catch {
          skipped++;
        }
      }
      return `${es["Asignaciones"]}: ${assigned}, ${es["Omitidas"]}: ${skipped}`;
    },
    onSuccess: async (msg) => {
      setAutoAssignResult(msg ?? null);
      await client.invalidateQueries({ queryKey: ["programa", congId] });
    },
    onError: (e) => setAutoAssignResult((e as Error).message),
  });

  function getPubName(id: string | null): string {
    if (!id) return "";
    return publishers.find((p) => p.id === id)?.nombre ?? "Desconocido";
  }

  function prayerName(tipo: "inicial" | "final"): string {
    const pr = prayers.find((p) => p.tipo === tipo);
    if (!pr?.publisher_id) return es["Sin asignar"];
    return getPubName(pr.publisher_id);
  }

  return (
    <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
      <Text style={{ fontSize: 20, fontWeight: "bold" }}>{es["Asignar"]}</Text>
      <Text>{es["Sala fija"]}: {es["Sala A"]}</Text>
      {offline ? <Text style={{ color: "#e74c3c" }}>{es["Sin conexión — verifique la IP del servidor"]}</Text> : null}

      <Text style={{ fontWeight: "bold", fontSize: 16 }}>{es["Reunión"]}</Text>
      {meetings.length === 0 ? <Text>{es["Sin reuniones todavía"]}</Text> : null}
      {meetings.map((m) => (
        <Button
          key={m.id}
          title={`${m.semana_label ? `${m.semana_label} · ` : ""}${fmtDate(m.fecha)} · ${m.tipo}`}
          onPress={() => {
            setMeetingId(m.id);
            setExpandedPart(null);
            setResult(null);
            setFormError(null);
            setPrayerSel({ inicial: null, final: null });
          }}
          color={m.id === meetingId ? "#0a7ea4" : undefined}
        />
      ))}

      {meeting ? (
        <View style={{ gap: 12 }}>
          {presPart ? (
            <PresidentSection
              part={presPart}
              publishers={available}
              congId={congId}
              offline={offline}
              getPubName={getPubName}
            />
          ) : (
            <View style={{ padding: 12, backgroundColor: "#eaf2f8", borderRadius: 8, borderWidth: 1, borderColor: "#aed6f1", gap: 6 }}>
              <Text style={{ fontWeight: "bold", fontSize: 15 }}>👤 {es["Presidente"]}</Text>
              <Text style={{ fontSize: 12, color: "#666" }}>
                Esta reunión no tiene parte de presidente para asignar.
              </Text>
            </View>
          )}

          {[...grouped.entries()].map(([sec, parts]) => (
            <View key={sec} style={{ gap: 8 }}>
              <Text style={{ fontWeight: "bold", fontSize: 14, color: "#555", marginTop: 8 }}>
                {SECTION_LABELS[sec] ?? sec}
              </Text>
              {parts.map((p) => (
                <PartCard
                  key={p.id}
                  part={p}
                  publishers={available}
                  publishersAll={publishers}
                  congId={congId}
                  offline={offline}
                  getPubName={getPubName}
                  expanded={expandedPart === p.id}
                  onToggle={() => setExpandedPart(expandedPart === p.id ? null : p.id)}
                />
              ))}
            </View>
          ))}

          <View style={{ gap: 8, marginTop: 8 }}>
            <Text style={{ fontWeight: "bold", fontSize: 14, color: "#555" }}>{es["Oración"]}</Text>
            {(["inicial", "final"] as const).map((tipo) => {
              const f = PART_FILTERS.wk_oracion ?? {};
              const eligible = available.filter((p) => matchesFilter(p, f));
              return (
                <View key={tipo} style={{ gap: 4, padding: 8, backgroundColor: "#f5f5f5", borderRadius: 6 }}>
                  <Text style={{ fontWeight: "600" }}>
                    {tipo === "final" ? es["Oración final"] : es["Oración inicial"]}: {prayerName(tipo)}
                  </Text>
                  <FlatList
                    data={eligible}
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
                    onPress={() => prayerMut.mutate({ tipo, publisher_id: prayerSel[tipo] })}
                    disabled={prayerMut.isPending || offline || !prayerSel[tipo]}
                  />
                </View>
              );
            })}
            {prayerMsg ? <Text>{prayerMsg}</Text> : null}
          </View>

          <View style={{ gap: 8, marginTop: 8, padding: 12, backgroundColor: "#eaf2f8", borderRadius: 8, borderWidth: 1, borderColor: "#aed6f1" }}>
            <Text style={{ fontWeight: "bold", fontSize: 14 }}>{es["Asignar todas"]}</Text>
            <Text style={{ fontSize: 12, color: "#666" }}>
              Asigna automáticamente las partes sin titular usando sugerencias del servidor.
            </Text>
            <Button
              title={autoAssignMut.isPending ? es["Asignando todas..."] : es["Asignar todas"]}
              onPress={() => autoAssignMut.mutate()}
              disabled={autoAssignMut.isPending || offline}
            />
            {autoAssignResult ? <Text style={{ fontSize: 12, color: "#27ae60" }}>{autoAssignResult}</Text> : null}
          </View>
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
