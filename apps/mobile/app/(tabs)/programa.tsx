// Reuniões — Programa semanal inteligente com header e modal calendário.
// Fase 30 — iOS + Android (Expo).

import { useState, useMemo } from "react";
import { Button, ScrollView, Text, View, TouchableOpacity, Modal } from "react-native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../../lib/auth";
import { getCongregationId, isNetworkError, publishMeeting, getConfig, type PublishResult } from "../../lib/api";
import { fmtDate, fmtTime, fmtLastSync, getWeekStart, calcMeetingDate, dayNameEs } from "../../lib/formatDate";
import { usePrograma } from "../../hooks/usePrograma";
import { makePubNameResolver, usePublishers } from "../../hooks/usePublishers";
import { SkeletonRow } from "../../components/Skeleton";
import es from "../../i18n/es.json";
import type { ProgramaMeeting } from "../../lib/dbPrograma";

const MEETING_TYPE_LABELS: Record<string, string> = {
  entre_semana: "Reunión entre semana",
  fin_semana: "Reunión fin de semana",
};

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

function estadoLabel(estado: string): string {
  return estado === "published" ? es["Publicado"] : es["Borrador"];
}

function excepcionLabel(ex: string): string {
  switch (ex) {
    case "convencao": return es["Convenção"];
    case "sin_reunion": return es["Sin reunión"];
    case "convencao_virtual": return es["Convenção virtual"];
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
  const weekStartDates = new Set(meetings.map((m) => getWeekStart(m.fecha)));

  const days: { date: string; dayNum: number; isCurrentMonth: boolean; isToday: boolean; isMeetingDay: boolean; isWeekHighlight: boolean }[] = [];

  // Preencher dias do mês anterior
  const prevMonth = new Date(year, month, 0);
  for (let i = startDow - 1; i >= 0; i--) {
    const d = prevMonth.getDate() - i;
    const m = prevMonth.getMonth() + 1;
    const y = prevMonth.getFullYear();
    const dateStr = `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    days.push({ date: dateStr, dayNum: d, isCurrentMonth: false, isToday: false, isMeetingDay: false, isWeekHighlight: false });
  }

  // Dias do mês atual
  for (let d = 1; d <= daysInMonth; d++) {
    const m = month + 1;
    const dateStr = `${year}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    days.push({
      date: dateStr,
      dayNum: d,
      isCurrentMonth: true,
      isToday: dateStr === today,
      isMeetingDay: meetingDates.has(dateStr),
      isWeekHighlight: weekStartDates.has(getWeekStart(dateStr)) && getWeekStart(dateStr) === currentWeekStart,
    });
  }

  // Preencher dias do próximo mês
  const remaining = 42 - days.length;
  const nextMonth = new Date(year, month + 1, 1);
  for (let d = 1; d <= remaining; d++) {
    const m = nextMonth.getMonth() + 1;
    const y = nextMonth.getFullYear();
    const dateStr = `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    days.push({ date: dateStr, dayNum: d, isCurrentMonth: false, isToday: false, isMeetingDay: false, isWeekHighlight: false });
  }

  const monthNames = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

  function prevMonthFn() {
    setViewDate(new Date(year, month - 1, 1));
  }

  function nextMonthFn() {
    setViewDate(new Date(year, month + 1, 1));
  }

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "center", padding: 20 }}>
        <View style={{ backgroundColor: "#fff", borderRadius: 12, padding: 16, gap: 12 }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
            <TouchableOpacity onPress={prevMonthFn} style={{ padding: 8 }}>
              <Text style={{ fontSize: 18 }}>{es["Volver"]}</Text>
            </TouchableOpacity>
            <Text style={{ fontSize: 16, fontWeight: "bold" }}>
              {monthNames[month]} {year}
            </Text>
            <TouchableOpacity onPress={nextMonthFn} style={{ padding: 8 }}>
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
                onPress={() => {
                  if (d.isCurrentMonth && d.isMeetingDay) {
                    onSelectDate(d.date);
                    onClose();
                  }
                }}
                style={{
                  width: 36,
                  height: 36,
                  margin: 1,
                  borderRadius: 18,
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: d.isToday
                    ? "#0a7ea4"
                    : d.isMeetingDay
                    ? "#eaf2f8"
                    : d.isWeekHighlight
                    ? "#f5f5f5"
                    : "transparent",
                  opacity: d.isCurrentMonth ? 1 : 0.3,
                }}
              >
                <Text
                  style={{
                    fontSize: 14,
                    color: d.isToday ? "#fff" : d.isMeetingDay ? "#0a7ea4" : "#333",
                    fontWeight: d.isToday || d.isMeetingDay ? "bold" : "normal",
                  }}
                >
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

// ── Card de reunião ──
function MeetingCard({
  m,
  pubName,
  pubMut,
  offline,
  config,
}: {
  m: ProgramaMeeting;
  pubName: (id: string | null) => string;
  pubMut: ReturnType<typeof useMutation<PublishResult, Error, string>>;
  offline: boolean;
  config: MeetingConfig | null;
}) {
  const salas = new Set(m.parts.map((p) => p.sala));
  const assigned = m.parts.filter((p) => p.titular_id).length;
  const total = m.parts.filter((p) => p.tipo_clave !== "cancion_inicial" && p.tipo_clave !== "cancion_intermedia" && p.tipo_clave !== "cancion_final").length;
  const isComplete = total > 0 && assigned >= total;
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
    ? (config?.midweekTime ?? m.hora_inicio)
    : (config?.weekendTime ?? m.hora_inicio);

  return (
    <View
      style={{
        paddingVertical: 10,
        paddingHorizontal: 12,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: isComplete ? "#27ae60" : "#e74c3c",
        backgroundColor: isComplete ? "#eafaf1" : "#fef9e7",
        gap: 4,
      }}
    >
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={{ fontWeight: "bold", fontSize: 14 }}>{tipoLabel}</Text>
          <Text style={{ fontSize: 13, color: "#333" }}>
            {displayDay} {fmtDate(displayDate)}
            {meetingTime ? ` · ${meetingTime}` : ""}
            {m.semana_label ? ` · ${m.semana_label}` : ""}
          </Text>
        </View>
        <View style={{ alignItems: "flex-end", gap: 2 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
            <View style={{ backgroundColor: salaColor([...salas][0] ?? "A"), borderRadius: 4, paddingHorizontal: 4, paddingVertical: 1 }}>
              <Text style={{ color: "#fff", fontSize: 10, fontWeight: "bold" }}>
                {[...salas].sort().join(",")}
              </Text>
            </View>
            <Text style={{ fontSize: 11, color: isComplete ? "#27ae60" : "#e74c3c", fontWeight: "600" }}>
              {assigned}/{total}
            </Text>
          </View>
        </View>
      </View>

      {m.excepcion ? (
        <Text style={{ color: "#e67e22", fontWeight: "bold", fontSize: 12 }}>
          {excepcionLabel(m.excepcion)}
        </Text>
      ) : null}
      {m.visita_co ? (
        <Text style={{ color: "#3498db", fontWeight: "bold", fontSize: 12 }}>
          Visita del CO
        </Text>
      ) : null}
      {m.lectura_semanal ? <Text style={{ fontSize: 12, color: "#555" }}>{m.lectura_semanal}</Text> : null}
      {m.titulo_atalaya ? <Text style={{ fontSize: 12, color: "#555" }}>{m.titulo_atalaya}</Text> : null}
      {m.prayers.length > 0 ? (
        <Text style={{ fontSize: 12, color: "#555" }}>
          {m.prayers
            .map((pr) =>
              `${pr.tipo === "final" ? es["Oración final"] : es["Oración inicial"]}: ${
                pr.publisher_id ? pubName(pr.publisher_id) : es["Sin asignar"]
              }`
            )
            .join(" · ")}
        </Text>
      ) : null}
      <Text style={{ fontSize: 11, color: isComplete ? "#27ae60" : "#888", marginTop: 2 }}>
        {estadoLabel(m.estado)}
      </Text>

      {m.parts.map((p) => (
        <View key={p.id} style={{ paddingLeft: 8, paddingVertical: 4, gap: 2, borderLeftWidth: 2, borderLeftColor: p.titular_id ? "#27ae60" : "#e74c3c", marginLeft: 4 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
            <View style={{ backgroundColor: salaColor(p.sala), borderRadius: 4, paddingHorizontal: 3, paddingVertical: 1 }}>
              <Text style={{ color: "#fff", fontSize: 9, fontWeight: "bold" }}>{p.sala}</Text>
            </View>
            <Text style={{ fontSize: 13 }}>
              {p.hora_inicio ? fmtTime(p.hora_inicio) : ""}
              {p.hora_fin ? ` - ${fmtTime(p.hora_fin)}` : ""}
              {p.hora_inicio || p.hora_fin ? " · " : ""}
              {p.orden}. {p.titulo}
              {p.duracion_min ? ` (${p.duracion_min} min)` : ""}
            </Text>
          </View>
          <Text style={{ paddingLeft: 16, fontSize: 12, color: p.titular_id ? "#333" : "#e74c3c" }}>
            {es["Titular"]}: {p.titular_id ? pubName(p.titular_id) : es["Sin asignar"]}
            {p.ayudante_id ? ` · ${es["Ayudante"]}: ${pubName(p.ayudante_id)}` : ""}
          </Text>
        </View>
      ))}

      {m.estado !== "published" ? (
        <Button
          title={pubMut.isPending ? es["Publicando..."] : es["Publicar"]}
          onPress={() => pubMut.mutate(m.id)}
          disabled={pubMut.isPending || offline}
        />
      ) : null}
    </View>
  );
}

// ── Tela principal ──
export default function Programa() {
  const { user } = useAuth();
  const congId = user ? getCongregationId() : null;
  const { meetings, offline, lastSync, isPending, isError, error, refetch, isFetching } =
    usePrograma(congId);
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
  const currentWeekStart = getWeekStart(today);
  const [selectedDate, setSelectedDate] = useState<string>(today);
  const [calendarVisible, setCalendarVisible] = useState(false);
  const [viewMode, setViewMode] = useState<"midweek" | "weekend">("midweek");

  // Determinar modo inicial baseado no dia
  const todayDow = new Date(today + "T00:00:00").getDay();
  if (config) {
    const midweekDay = config.midweekDay;
    const weekendDay = config.weekendDay;
    // Se hoje é depois do meio de semana, mostrar fim de semana
    if (todayDow > midweekDay && todayDow <= weekendDay) {
      // Já é weekend mode
    } else if (todayDow > weekendDay || todayDow < midweekDay) {
      // Já passou ambas, mostrar próximo fim de semana
    }
  }

  // Reuniões da semana selecionada
  const selectedWeekStart = getWeekStart(selectedDate);
  const weekMeetings = useMemo(() => {
    return meetings.filter((m) => getWeekStart(m.fecha) === selectedWeekStart);
  }, [meetings, selectedWeekStart]);

  // Filtrar por tipo selecionado
  const displayedMeetings = useMemo(() => {
    const filtered = viewMode === "midweek"
      ? weekMeetings.filter((m) => m.tipo === "entre_semana")
      : weekMeetings.filter((m) => m.tipo === "fin_semana");
    return filtered;
  }, [weekMeetings, viewMode]);

  const pub = useMutation({
    mutationFn: async (meetingId: string) => {
      if (!congId) throw new Error(es["Sin conexión"]);
      return publishMeeting(congId, meetingId);
    },
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: ["programa", congId] });
    },
  });

  // Calcular datas da semana para o header
  const midweekDate = config ? calcMeetingDate(selectedWeekStart, config.midweekDay) : "";
  const weekendDate = config ? calcMeetingDate(selectedWeekStart, config.weekendDay) : "";

  return (
    <View style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
        <Text style={{ fontSize: 20, fontWeight: "bold" }}>{es["Reuniones"]}</Text>

        {/* Header: < [Semana] > */}
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
          <TouchableOpacity
            onPress={() => {
              const prevWeek = new Date(selectedWeekStart + "T00:00:00");
              prevWeek.setDate(prevWeek.getDate() - 7);
              const dd = String(prevWeek.getDate()).padStart(2, "0");
              const mm = String(prevWeek.getMonth() + 1).padStart(2, "0");
              setSelectedDate(`${prevWeek.getFullYear()}-${mm}-${dd}`);
            }}
            style={{ padding: 8, backgroundColor: "#f0f0f0", borderRadius: 6 }}
          >
            <Text style={{ fontSize: 18 }}>{es["Volver"]}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => setCalendarVisible(true)}
            style={{ flex: 1, padding: 10, backgroundColor: "#eaf2f8", borderRadius: 8, alignItems: "center" }}
          >
            <Text style={{ fontSize: 12, color: "#555" }}>{es["Semana"]}</Text>
            <Text style={{ fontSize: 14, fontWeight: "bold", color: "#1a5276" }}>
              {fmtDate(midweekDate)} - {fmtDate(weekendDate)}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => {
              const nextWeek = new Date(selectedWeekStart + "T00:00:00");
              nextWeek.setDate(nextWeek.getDate() + 7);
              const dd = String(nextWeek.getDate()).padStart(2, "0");
              const mm = String(nextWeek.getMonth() + 1).padStart(2, "0");
              setSelectedDate(`${nextWeek.getFullYear()}-${mm}-${dd}`);
            }}
            style={{ padding: 8, backgroundColor: "#f0f0f0", borderRadius: 6 }}
          >
            <Text style={{ fontSize: 18 }}>{">"}</Text>
          </TouchableOpacity>
        </View>

        {/* Seletor meio de semana / fim de semana */}
        <View style={{ flexDirection: "row", gap: 8 }}>
          <TouchableOpacity
            onPress={() => setViewMode("midweek")}
            style={{
              flex: 1,
              padding: 10,
              borderRadius: 8,
              borderWidth: 1,
              borderColor: viewMode === "midweek" ? "#0a7ea4" : "#ccc",
              backgroundColor: viewMode === "midweek" ? "#eaf2f8" : "#fff",
              alignItems: "center",
            }}
          >
            <Text style={{ fontSize: 13, fontWeight: viewMode === "midweek" ? "bold" : "normal", color: viewMode === "midweek" ? "#0a7ea4" : "#333" }}>
              {es["Reunión entre semana"]}
            </Text>
            {config ? (
              <Text style={{ fontSize: 11, color: "#666" }}>
                {dayNameEs(config.midweekDay)} {fmtDate(midweekDate)}
              </Text>
            ) : null}
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => setViewMode("weekend")}
            style={{
              flex: 1,
              padding: 10,
              borderRadius: 8,
              borderWidth: 1,
              borderColor: viewMode === "weekend" ? "#0a7ea4" : "#ccc",
              backgroundColor: viewMode === "weekend" ? "#eaf2f8" : "#fff",
              alignItems: "center",
            }}
          >
            <Text style={{ fontSize: 13, fontWeight: viewMode === "weekend" ? "bold" : "normal", color: viewMode === "weekend" ? "#0a7ea4" : "#333" }}>
              {es["Reunión fin de semana"]}
            </Text>
            {config ? (
              <Text style={{ fontSize: 11, color: "#666" }}>
                {dayNameEs(config.weekendDay)} {fmtDate(weekendDate)}
              </Text>
            ) : null}
          </TouchableOpacity>
        </View>

        {/* Botão sincronizar */}
        <View style={{ flexDirection: "row", gap: 8 }}>
          <Button
            title={isFetching ? es["Sincronizando..."] : es["Sincronizar"]}
            onPress={() => refetch()}
            disabled={isFetching}
          />
        </View>
        {offline ? <Text style={{ color: "#e74c3c" }}>{es["Sin conexión — verifique la IP del servidor"]}</Text> : null}
        {lastSync && !offline ? <Text style={{ fontSize: 12, color: "#666" }}>{es["Sincronizado"]}: {fmtLastSync(lastSync)}</Text> : null}

        {isPending ? <SkeletonRow lines={5} /> : null}
        {isError && meetings.length === 0 ? (
          <Text>{(error as Error)?.message ?? es["Error al cargar el programa"]}</Text>
        ) : null}

        {/* Lista de reuniões */}
        {displayedMeetings.length === 0 ? (
          <View style={{ padding: 20, alignItems: "center" }}>
            <Text style={{ fontSize: 14, color: "#888" }}>{es["Sin programa esta semana"]}</Text>
          </View>
        ) : (
          displayedMeetings.map((m) => (
            <MeetingCard
              key={m.id}
              m={m}
              pubName={pubName}
              pubMut={pub}
              offline={offline}
              config={config}
            />
          ))
        )}
      </ScrollView>

      <MonthCalendar
        visible={calendarVisible}
        onClose={() => setCalendarVisible(false)}
        onSelectDate={(date) => {
          setSelectedDate(date);
          const dow = new Date(date + "T00:00:00").getDay();
          if (config && dow === config.weekendDay) {
            setViewMode("weekend");
          } else {
            setViewMode("midweek");
          }
        }}
        meetings={meetings}
        config={config}
        currentWeekStart={selectedWeekStart}
      />
    </View>
  );
}
