// Asignar — fluxo: reunião → presidente → partes com filtros.
// Cânticos não são designáveis. Online-only.
// Componentes PresidentSection e PartCard em ../components/AsignarCards.tsx

import { useState, useMemo } from "react";
import { Button, FlatList, ScrollView, Text, View, TouchableOpacity } from "react-native";
import { useRouter } from "expo-router";
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
  getConfig,
  type SyncPrayer,
} from "../../lib/api";
import { fmtDate, getWeekStart, calcMeetingDate, dayNameEs } from "../../lib/formatDate";
import { usePrograma } from "../../hooks/usePrograma";
import { usePublishers } from "../../hooks/usePublishers";
import { matchesFilter, PART_FILTERS, PresidentSection, PartCard } from "../../components/AsignarCards";
import type { ProgramaMeeting } from "../../lib/dbPrograma";

const SECTION_LABELS: Record<string, string> = {
  TESOROS: "Tesoros de la Palabra de Dios",
  MAESTROS: "Haz tu mejor ministerio",
  VIDA: "Nuestra vida cristiana",
  EBC: "Estudio Bíblico de la congregación",
  SENTINELA: "Sentinela",
  ATALAYA: "Estudio de la Atalaya",
};

const MEETING_TYPE_LABELS: Record<string, string> = {
  entre_semana: "Entre semana",
  fin_semana: "Fin de semana",
};

function todayStr(): string {
  const d = new Date();
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}

interface MeetingConfig {
  midweekDay: number;
  midweekTime: string;
  weekendDay: number;
  weekendTime: string;
}

function classifyMeetings(meetings: ProgramaMeeting[], config: MeetingConfig | null) {
  const today = todayStr();
  const currentWeekStart = getWeekStart(today);
  const current: ProgramaMeeting[] = [];
  const future: ProgramaMeeting[] = [];
  const past: ProgramaMeeting[] = [];
  for (const m of meetings) {
    const mWeek = getWeekStart(m.fecha);
    if (mWeek === currentWeekStart) {
      current.push(m);
    } else if (m.fecha >= today) {
      future.push(m);
    } else {
      past.push(m);
    }
  }
  const sortFn = (a: ProgramaMeeting, b: ProgramaMeeting) => {
    if (a.tipo === "entre_semana" && b.tipo === "fin_semana") return -1;
    if (a.tipo === "fin_semana" && b.tipo === "entre_semana") return 1;
    return a.fecha.localeCompare(b.fecha);
  };
  return { current: current.sort(sortFn), future: future.sort(sortFn), past: past.sort(sortFn) };
}

function assignmentColor(m: ProgramaMeeting): string {
  const assignable = m.parts.filter(
    (p) => p.tipo_clave !== "cancion_inicial" && p.tipo_clave !== "cancion_intermedia" && p.tipo_clave !== "cancion_final"
  );
  if (assignable.length === 0) return "#ccc";
  const assigned = assignable.filter((p) => p.titular_id).length;
  if (assigned >= assignable.length) return "#27ae60";
  if (assigned > 0) return "#f39c12";
  return "#e74c3c";
}

function MeetingChip({
  m,
  selected,
  onPress,
  config,
}: {
  m: ProgramaMeeting;
  selected: boolean;
  onPress: () => void;
  config: MeetingConfig | null;
}) {
  const color = assignmentColor(m);
  const assignable = m.parts.filter(
    (p) => p.tipo_clave !== "cancion_inicial" && p.tipo_clave !== "cancion_intermedia" && p.tipo_clave !== "cancion_final"
  );
  const assigned = assignable.filter((p) => p.titular_id).length;
  const tipoLabel = MEETING_TYPE_LABELS[m.tipo] ?? m.tipo;

  const weekStart = getWeekStart(m.fecha);
  let displayDate = m.fecha;
  let displayDay = "";
  if (config) {
    const dayOfWeek = m.tipo === "entre_semana" ? config.midweekDay : config.weekendDay;
    displayDate = calcMeetingDate(weekStart, dayOfWeek);
    displayDay = dayNameEs(dayOfWeek);
  } else {
    const d = new Date(m.fecha + "T00:00:00");
    const days = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sab"];
    displayDay = days[d.getDay()];
  }

  const meetingTime = m.tipo === "entre_semana"
    ? (config?.midweekTime ?? null)
    : (config?.weekendTime ?? null);

  return (
    <TouchableOpacity
      onPress={onPress}
      style={{
        paddingVertical: 8,
        paddingHorizontal: 12,
        borderRadius: 8,
        borderWidth: 2,
        borderColor: selected ? "#0a7ea4" : color,
        backgroundColor: selected ? "#eaf2f8" : "#fff",
        gap: 2,
      }}
    >
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
        <Text style={{ fontWeight: "600", fontSize: 13 }}>
          {displayDay} {fmtDate(displayDate)}
        </Text>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
          <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: color }} />
          <Text style={{ fontSize: 11, color: "#666" }}>
            {assigned}/{assignable.length}
          </Text>
        </View>
      </View>
      <Text style={{ fontSize: 12, color: "#555" }}>
        {tipoLabel}
        {meetingTime ? ` \u00B7 ${meetingTime}` : ""}
        {m.semana_label ? ` \u00B7 ${m.semana_label}` : ""}
      </Text>
    </TouchableOpacity>
  );
}

export default function Asignar() {
  const congId = getCongregationId();
  const { meetings, offline } = usePrograma(congId);
  const client = useQueryClient();
  const router = useRouter();
  const [meetingId, setMeetingId] = useState<string | null>(null);
  const [expandedPart, setExpandedPart] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [result, setResult] = useState<{ warnings: { tipo: string; mensaje_es: string }[] } | null>(null);
  const [prayerSel, setPrayerSel] = useState<{ inicial: string | null; final: string | null }>({ inicial: null, final: null });
  const [prayerMsg, setPrayerMsg] = useState<string | null>(null);

  // Buscar configuração
  const { data: configData } = useQuery({
    queryKey: ["config", congId],
    queryFn: () => getConfig(congId!),
    enabled: !!congId,
    retry: 1,
    staleTime: 0,
    refetchOnWindowFocus: true,
  });
  const config = configData?.config ?? null;

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

  const { current, future } = useMemo(() => classifyMeetings(meetings, config), [meetings, config]);
  const orderedMeetings = useMemo(() => [...current, ...future], [current, future]);

  function selectMeeting(id: string) {
    setMeetingId(id);
    setExpandedPart(null);
    setResult(null);
    setFormError(null);
    setPrayerSel({ inicial: null, final: null });
  }

  return (
    <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
        <TouchableOpacity onPress={() => router.back()} style={{ padding: 8 }}>
          <Text style={{ fontSize: 18 }}>{es["Volver"]}</Text>
        </TouchableOpacity>
        <Text style={{ fontSize: 20, fontWeight: "bold" }}>{es["Asignar"]}</Text>
      </View>
      {offline ? <Text style={{ color: "#e74c3c" }}>{es["Sin conexión — verifique la IP del servidor"]}</Text> : null}

      {meetings.length === 0 ? <Text>{es["Sin reuniones todavía"]}</Text> : null}

      {current.length > 0 ? (
        <View style={{ gap: 6 }}>
          <Text style={{ fontWeight: "bold", fontSize: 14, color: "#1a5276" }}>Semana actual</Text>
          {current.map((m) => (
            <MeetingChip key={m.id} m={m} selected={m.id === meetingId} onPress={() => selectMeeting(m.id)} config={config} />
          ))}
        </View>
      ) : null}

      {future.length > 0 ? (
        <View style={{ gap: 6 }}>
          <Text style={{ fontWeight: "bold", fontSize: 14, color: "#7d3c98" }}>Próximas reuniones</Text>
          {future.map((m) => (
            <MeetingChip key={m.id} m={m} selected={m.id === meetingId} onPress={() => selectMeeting(m.id)} config={config} />
          ))}
        </View>
      ) : null}

      {meeting ? (
        <View style={{ gap: 12, marginTop: 8 }}>
          {presPart ? (
            <PresidentSection
              part={presPart}
              publishers={available}
              congId={congId}
              offline={offline}
              getPubName={getPubName}
            />
          ) : null}

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
            <Text key={`${w.tipo}-${i}`}>{"\u26A0"} {w.mensaje_es}</Text>
          ))}
        </View>
      ) : null}
    </ScrollView>
  );
}
