// Reuniões — Programa semanal com layout inspirado no app JW.
// Fase 30 — iOS + Android (Expo). Cores claras, seções agrupadas.

import { useState, useMemo } from "react";
import { ScrollView, Text, View, TouchableOpacity, Modal } from "react-native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../../lib/auth";
import { getCongregationId, publishMeeting, getConfig } from "../../lib/api";
import { fmtDate, fmtTime, getWeekStart, calcMeetingDate, dayNameEs } from "../../lib/formatDate";
import { usePrograma } from "../../hooks/usePrograma";
import { makePubNameResolver, usePublishers } from "../../hooks/usePublishers";
import { SkeletonRow } from "../../components/Skeleton";
import es from "../../i18n/es.json";
import type { ProgramaMeeting, ProgramaPart } from "../../lib/dbPrograma";

interface MeetingConfig {
  midweekDay: number;
  midweekTime: string;
  weekendDay: number;
  weekendTime: string;
}

function todayStr(): string {
  const d = new Date();
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}

// ── Cores das seções (claras) ──
const SECTION_META: Record<string, { label: string; bg: string; icon: string; timeBg: string; timeColor: string }> = {
  CANCION:    { label: "", bg: "transparent", icon: "", timeBg: "#e8f0fe", timeColor: "#1a73e8" },
  PRESIDENTE: { label: "", bg: "transparent", icon: "", timeBg: "#e8f0fe", timeColor: "#1a73e8" },
  TESOROS:    { label: "TESOROS DE LA BIBLIA", bg: "#f5e6d3", icon: "\u{1F48E}", timeBg: "#d4a574", timeColor: "#fff" },
  MAESTROS:   { label: "SEAMOS MEJORES MAESTROS", bg: "#fef3cd", icon: "\u{1F468}\u200D\u{1F3EB}", timeBg: "#f0c040", timeColor: "#fff" },
  VIDA:       { label: "NUESTRA VIDA CRISTIANA", bg: "#d4edda", icon: "\u{1F411}", timeBg: "#6abf69", timeColor: "#fff" },
  EBC:        { label: "", bg: "transparent", icon: "", timeBg: "#e8f0fe", timeColor: "#1a73e8" },
  ORACION:    { label: "", bg: "transparent", icon: "", timeBg: "#e8f0fe", timeColor: "#1a73e8" },
  DISCURSO:   { label: "PUBLIC TALK", bg: "#d6eaf8", icon: "\u{1F468}\u200D\u{1F3EB}", timeBg: "#5dade2", timeColor: "#fff" },
  SENTINELA:  { label: "", bg: "transparent", icon: "", timeBg: "#e8f0fe", timeColor: "#1a73e8" },
  ATALAYA:    { label: "ESTUDIO DE LA ATALAYA", bg: "#d5f5e3", icon: "\u{1F310}", timeBg: "#27ae60", timeColor: "#fff" },
  OTROS:      { label: "", bg: "transparent", icon: "", timeBg: "#e8f0fe", timeColor: "#1a73e8" },
};

function sectionMeta(seccion: string | null) {
  return SECTION_META[seccion ?? "OTROS"] ?? SECTION_META.OTROS;
}

// ── Calendário mensal ──
function MonthCalendar({
  visible,
  onClose,
  onSelectDate,
  meetings,
  config,
  currentWeekStart,
}: {
  visible: boolean;
  onClose: () => void;
  onSelectDate: (date: string) => void;
  meetings: ProgramaMeeting[];
  config: MeetingConfig | null;
  currentWeekStart: string;
}) {
  const today = todayStr();
  const [viewDate, setViewDate] = useState(new Date());
  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startDow = firstDay.getDay();
  const daysInMonth = lastDay.getDate();
  const meetingDates = new Set(meetings.map((m) => m.fecha));

  const days: { date: string; dayNum: number; isCurrentMonth: boolean; isToday: boolean; isMeetingDay: boolean; isWeekHighlight: boolean }[] = [];
  const prevMonth = new Date(year, month, 0);
  for (let i = startDow - 1; i >= 0; i--) {
    const d = prevMonth.getDate() - i;
    const m = prevMonth.getMonth() + 1;
    const y = prevMonth.getFullYear();
    const dateStr = `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    days.push({ date: dateStr, dayNum: d, isCurrentMonth: false, isToday: false, isMeetingDay: false, isWeekHighlight: false });
  }
  for (let d = 1; d <= daysInMonth; d++) {
    const m = month + 1;
    const dateStr = `${year}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    days.push({
      date: dateStr,
      dayNum: d,
      isCurrentMonth: true,
      isToday: dateStr === today,
      isMeetingDay: meetingDates.has(dateStr),
      isWeekHighlight: getWeekStart(dateStr) === currentWeekStart,
    });
  }
  const remaining = 42 - days.length;
  const nextMonth = new Date(year, month + 1, 1);
  for (let d = 1; d <= remaining; d++) {
    const m = nextMonth.getMonth() + 1;
    const y = nextMonth.getFullYear();
    const dateStr = `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    days.push({ date: dateStr, dayNum: d, isCurrentMonth: false, isToday: false, isMeetingDay: false, isWeekHighlight: false });
  }

  const monthNames = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "center", padding: 20 }}>
        <View style={{ backgroundColor: "#fff", borderRadius: 12, padding: 16, gap: 12 }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
            <TouchableOpacity onPress={() => setViewDate(new Date(year, month - 1, 1))} style={{ padding: 8 }}>
              <Text style={{ fontSize: 18 }}>{es["Volver"]}</Text>
            </TouchableOpacity>
            <Text style={{ fontSize: 16, fontWeight: "bold" }}>{monthNames[month]} {year}</Text>
            <TouchableOpacity onPress={() => setViewDate(new Date(year, month + 1, 1))} style={{ padding: 8 }}>
              <Text style={{ fontSize: 18 }}>{">"}</Text>
            </TouchableOpacity>
          </View>
          <View style={{ flexDirection: "row", justifyContent: "space-around" }}>
            {["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"].map((d) => (
              <Text key={d} style={{ width: 36, textAlign: "center", fontSize: 12, color: "#888", fontWeight: "600" }}>{d}</Text>
            ))}
          </View>
          <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
            {days.map((d, i) => (
              <TouchableOpacity
                key={i}
                onPress={() => { if (d.isCurrentMonth && d.isMeetingDay) { onSelectDate(d.date); onClose(); } }}
                style={{
                  width: 36, height: 36, margin: 1, borderRadius: 18,
                  alignItems: "center", justifyContent: "center",
                  backgroundColor: d.isToday ? "#1a5276" : d.isMeetingDay ? "#eaf2f8" : d.isWeekHighlight ? "#f5f5f5" : "transparent",
                  opacity: d.isCurrentMonth ? 1 : 0.3,
                }}
              >
                <Text style={{ fontSize: 14, color: d.isToday ? "#fff" : d.isMeetingDay ? "#1a5276" : "#333", fontWeight: d.isToday || d.isMeetingDay ? "bold" : "normal" }}>
                  {d.dayNum}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <TouchableOpacity onPress={onClose} style={{ padding: 12, alignItems: "center" }}>
            <Text style={{ fontSize: 14, color: "#888" }}>{es["Cancelar"]}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

// ── Seção do programa ──
function SectionBlock({
  sectionKey,
  parts,
  pubName,
  config,
  startTime,
}: {
  sectionKey: string;
  parts: ProgramaPart[];
  pubName: (id: string | null) => string;
  config: MeetingConfig | null;
  startTime: string;
}) {
  const meta = sectionMeta(sectionKey);
  if (!meta.label) {
    return (
      <View style={{ gap: 0 }}>
        {parts.map((p, i) => <PartRow key={p.id} p={p} pubName={pubName} config={config} startTime={startTime} index={i} />)}
      </View>
    );
  }
  return (
    <View style={{ marginTop: 8 }}>
      <View style={{ backgroundColor: meta.bg, paddingVertical: 10, paddingHorizontal: 14, borderRadius: 8, flexDirection: "row", alignItems: "center", gap: 8 }}>
        <Text style={{ fontSize: 20 }}>{meta.icon}</Text>
        <Text style={{ fontSize: 15, fontWeight: "bold", color: "#333", letterSpacing: 0.5 }}>{meta.label}</Text>
      </View>
      <View style={{ gap: 0, paddingTop: 4 }}>
        {parts.map((p, i) => <PartRow key={p.id} p={p} pubName={pubName} config={config} startTime={startTime} index={i} />)}
      </View>
    </View>
  );
}

// ── Linha de parte ──
function PartRow({
  p,
  pubName,
  config,
  startTime,
  index,
}: {
  p: ProgramaPart;
  pubName: (id: string | null) => string;
  config: MeetingConfig | null;
  startTime: string;
  index: number;
}) {
  const meta = sectionMeta(p.seccion);
  const isSong = p.tipo_clave?.startsWith("cancion");
  const titular = p.titular_id ? pubName(p.titular_id) : null;
  const ayudante = p.ayudante_id ? pubName(p.ayudante_id) : null;

  // Calcular horário baseado no início da reunião e duração acumulada
  let displayTime = p.hora_inicio;
  if (!displayTime && startTime) {
    const [h, m] = startTime.split(":").map(Number);
    let totalMin = h * 60 + m;
    // Somar duração das partes anteriores na mesma seção
    // Usar orden para calcular posição
    totalMin += (p.orden - 1) * 5; // Estimativa: 5 min por parte anterior
    const calcH = Math.floor(totalMin / 60);
    const calcM = totalMin % 60;
    displayTime = `${String(calcH).padStart(2, "0")}:${String(calcM).padStart(2, "0")}`;
  }

  return (
    <View style={{ flexDirection: "row", alignItems: "center", paddingVertical: 8, paddingHorizontal: 14, borderBottomWidth: 0.5, borderBottomColor: "#eee" }}>
      {displayTime ? (
        <View style={{ backgroundColor: meta.timeBg, borderRadius: 4, paddingHorizontal: 6, paddingVertical: 3, minWidth: 44, alignItems: "center", marginRight: 12 }}>
          <Text style={{ fontSize: 12, fontWeight: "bold", color: meta.timeColor }}>{fmtTime(displayTime)}</Text>
        </View>
      ) : (
        <View style={{ width: 44, marginRight: 12 }} />
      )}
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 14, color: "#333", fontWeight: isSong ? "normal" : "500" }}>
          {p.titulo}
          {p.duracion_min ? ` (${p.duracion_min} min)` : ""}
        </Text>
      </View>
      {titular ? (
        <View style={{ alignItems: "flex-end", marginLeft: 8 }}>
          <Text style={{ fontSize: 13, color: "#555" }}>{titular}</Text>
          {ayudante ? <Text style={{ fontSize: 12, color: "#888" }}>{ayudante}</Text> : null}
        </View>
      ) : null}
      <Text style={{ fontSize: 14, color: "#ccc", marginLeft: 6 }}>{">"}</Text>
    </View>
  );
}

// ── Tela principal ──
export default function Programa() {
  const { user } = useAuth();
  const congId = user ? getCongregationId() : null;
  const { meetings, offline, lastSync, isPending, isError, error, refetch, isFetching } = usePrograma(congId);
  const { data: publishers } = usePublishers(congId);
  const pubName = makePubNameResolver(publishers ?? []);
  const client = useQueryClient();

  const { data: configData } = useQuery({
    queryKey: ["config", congId],
    queryFn: () => getConfig(congId!),
    enabled: !!congId,
    retry: 1,
    staleTime: 0,
    refetchOnWindowFocus: true,
  });
  const config: MeetingConfig | null = configData?.config ?? null;

  const today = todayStr();
  const [selectedDate, setSelectedDate] = useState(today);
  const [calendarVisible, setCalendarVisible] = useState(false);
  const [viewMode, setViewMode] = useState<"midweek" | "weekend">("midweek");

  const selectedWeekStart = getWeekStart(selectedDate);

  const weekMeetings = useMemo(() => {
    return meetings.filter((m) => getWeekStart(m.fecha) === selectedWeekStart);
  }, [meetings, selectedWeekStart]);

  const selectedMeeting = useMemo(() => {
    return weekMeetings.find((m) =>
      viewMode === "midweek" ? m.tipo === "entre_semana" : m.tipo === "fin_semana"
    ) ?? null;
  }, [weekMeetings, viewMode]);

  // Agrupar partes por seção
  const grouped = useMemo(() => {
    if (!selectedMeeting) return [];
    const order = ["CANCION", "PRESIDENTE", "TESOROS", "MAESTROS", "VIDA", "EBC", "ORACION", "DISCURSO", "SENTINELA", "ATALAYA"];
    const map = new Map<string, ProgramaPart[]>();
    for (const p of selectedMeeting.parts) {
      const sec = p.seccion ?? "OTROS";
      if (!map.has(sec)) map.set(sec, []);
      map.get(sec)!.push(p);
    }
    const result: { key: string; parts: ProgramaPart[] }[] = [];
    for (const key of order) {
      if (map.has(key)) result.push({ key, parts: map.get(key)! });
    }
    for (const [key, parts] of map) {
      if (!order.includes(key)) result.push({ key, parts });
    }
    return result;
  }, [selectedMeeting]);

  const midweekDate = config ? calcMeetingDate(selectedWeekStart, config.midweekDay) : "";
  const weekendDate = config ? calcMeetingDate(selectedWeekStart, config.weekendDay) : "";

  const pub = useMutation({
    mutationFn: async (meetingId: string) => {
      if (!congId) throw new Error(es["Sin conexión"]);
      return publishMeeting(congId, meetingId);
    },
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: ["programa", congId] });
    },
  });

  const weekStart = new Date(selectedWeekStart + "T00:00:00");
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 6);
  const fmtShort = (d: Date) => `${d.getDate()}/${d.getMonth() + 1}/${String(d.getFullYear()).slice(2)}`;

  return (
    <View style={{ flex: 1, backgroundColor: "#f8f9fa" }}>
      {/* Header */}
      <View style={{ backgroundColor: "#1a5276", paddingTop: 12, paddingBottom: 12, paddingHorizontal: 16 }}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <TouchableOpacity onPress={() => {
            const prev = new Date(selectedWeekStart + "T00:00:00");
            prev.setDate(prev.getDate() - 7);
            const dd = String(prev.getDate()).padStart(2, "0");
            const mm = String(prev.getMonth() + 1).padStart(2, "0");
            setSelectedDate(`${prev.getFullYear()}-${mm}-${dd}`);
          }}>
            <Text style={{ fontSize: 22, color: "#fff" }}>{"<"}</Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={() => setCalendarVisible(true)} style={{ alignItems: "center", flex: 1 }}>
            <Text style={{ fontSize: 13, color: "#aed6f1" }}>Semana comenzando {fmtShort(weekStart)}</Text>
            <Text style={{ fontSize: 14, color: "#fff", fontWeight: "bold" }}>
              {selectedMeeting?.semana_label ?? ""}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={() => {
            const next = new Date(selectedWeekStart + "T00:00:00");
            next.setDate(next.getDate() + 7);
            const dd = String(next.getDate()).padStart(2, "0");
            const mm = String(next.getMonth() + 1).padStart(2, "0");
            setSelectedDate(`${next.getFullYear()}-${mm}-${dd}`);
          }}>
            <Text style={{ fontSize: 22, color: "#fff" }}>{">"}</Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={() => refetch()} style={{ marginLeft: 12 }}>
            <Text style={{ fontSize: 20 }}>{isFetching ? "\u23F3" : "\u2601"}</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Seletor meio/fim de semana */}
      <View style={{ flexDirection: "row", backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: "#e0e0e0" }}>
        <TouchableOpacity
          onPress={() => setViewMode("midweek")}
          style={{ flex: 1, paddingVertical: 10, alignItems: "center", borderBottomWidth: 2, borderBottomColor: viewMode === "midweek" ? "#1a5276" : "transparent" }}
        >
          <Text style={{ fontSize: 12, color: viewMode === "midweek" ? "#1a5276" : "#888", fontWeight: viewMode === "midweek" ? "bold" : "normal" }}>
            Entre semana
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => setViewMode("weekend")}
          style={{ flex: 1, paddingVertical: 10, alignItems: "center", borderBottomWidth: 2, borderBottomColor: viewMode === "weekend" ? "#1a5276" : "transparent" }}
        >
          <Text style={{ fontSize: 12, color: viewMode === "weekend" ? "#1a5276" : "#888", fontWeight: viewMode === "weekend" ? "bold" : "normal" }}>
            Fin de semana
          </Text>
        </TouchableOpacity>
      </View>

      {/* Dia da reunião */}
      {selectedMeeting ? (
        <View style={{ backgroundColor: "#eaf2f8", paddingVertical: 10, paddingHorizontal: 16, flexDirection: "row", alignItems: "center", gap: 8 }}>
          <View style={{ flexDirection: "row", gap: 4 }}>
            {weekMeetings.map((m) => {
              const isActive = m.id === selectedMeeting.id;
              return <View key={m.id} style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: isActive ? "#1a5276" : "#ccc" }} />;
            })}
          </View>
          <Text style={{ fontSize: 14, fontWeight: "600", color: "#1a5276", flex: 1 }}>
            {dayNameEs(config ? (viewMode === "midweek" ? config.midweekDay : config.weekendDay) : 1)} | {selectedMeeting.tipo === "entre_semana" ? "REUNIÓN DE ENTRE SEMANA" : "REUNIÓN DEL FIN DE SEMANA"}
          </Text>
        </View>
      ) : null}

      <ScrollView contentContainerStyle={{ padding: 12, gap: 4 }}>
        {isPending ? <SkeletonRow lines={8} /> : null}
        {isError && meetings.length === 0 ? (
          <Text>{(error as Error)?.message ?? es["Error al cargar el programa"]}</Text>
        ) : null}

        {!isPending && !selectedMeeting ? (
          <View style={{ padding: 40, alignItems: "center" }}>
            <Text style={{ fontSize: 16, color: "#888" }}>{es["Sin programa esta semana"]}</Text>
          </View>
        ) : null}

        {selectedMeeting ? (
          <>
            {/* Presidente */}
            {selectedMeeting.parts.filter((p) => p.seccion === "PRESIDENTE").length > 0 ? (
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 10, paddingHorizontal: 14, borderBottomWidth: 0.5, borderBottomColor: "#eee" }}>
                <Text style={{ fontSize: 14, color: "#333" }}>Presidente</Text>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                  <Text style={{ fontSize: 14, color: "#555" }}>
                    {selectedMeeting.parts.find((p) => p.seccion === "PRESIDENTE")?.titular_id
                      ? pubName(selectedMeeting.parts.find((p) => p.seccion === "PRESIDENTE")!.titular_id)
                      : es["Sin asignar"]}
                  </Text>
                  <Text style={{ fontSize: 14, color: "#ccc" }}>{">"}</Text>
                </View>
              </View>
            ) : null}

            {/* Seções */}
            {(() => {
              const meetingStartTime = config
                ? (viewMode === "midweek" ? config.midweekTime : config.weekendTime)
                : (selectedMeeting.hora_inicio ?? "09:00");
              return grouped.filter((g) => g.key !== "PRESIDENTE" && g.key !== "CANCION").map((g) => (
                <SectionBlock key={g.key} sectionKey={g.key} parts={g.parts} pubName={pubName} config={config} startTime={meetingStartTime} />
              ));
            })()}

            {/* Cântico final + oração */}
            {selectedMeeting.prayers.length > 0 ? (
              <View style={{ marginTop: 12, padding: 14, backgroundColor: "#f5f5f5", borderRadius: 8 }}>
                <Text style={{ fontSize: 13, color: "#666" }}>
                  {selectedMeeting.prayers.map((pr) =>
                    `${pr.tipo === "final" ? es["Oración final"] : es["Oración inicial"]}: ${pr.publisher_id ? pubName(pr.publisher_id) : es["Sin asignar"]}`
                  ).join(" · ")}
                </Text>
              </View>
            ) : null}
          </>
        ) : null}
      </ScrollView>

      <MonthCalendar
        visible={calendarVisible}
        onClose={() => setCalendarVisible(false)}
        onSelectDate={(date) => {
          setSelectedDate(date);
          const dow = new Date(date + "T00:00:00").getDay();
          if (config && dow === config.weekendDay) setViewMode("weekend");
          else setViewMode("midweek");
        }}
        meetings={meetings}
        config={config}
        currentWeekStart={selectedWeekStart}
      />
    </View>
  );
}
