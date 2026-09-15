// Reuniões — Programa semanal com layout inspirado no app JW.
// Fase 31 — iOS + Android (Expo). Cores claras, seções agrupadas.
// Reunião de meio de semana segue a estrutura exata das imagens de referência.

import { useState, useMemo } from "react";
import { ScrollView, Text, View, TouchableOpacity } from "react-native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../../lib/auth";
import { getCongregationId, publishMeeting, getConfig } from "../../lib/api";
import { fmtDate, getWeekStart, calcMeetingDate, dayNameEs } from "../../lib/formatDate";
import { usePrograma } from "../../hooks/usePrograma";
import { makePubNameResolver, usePublishers } from "../../hooks/usePublishers";
import { SkeletonRow } from "../../components/Skeleton";
import { MonthCalendar } from "../../components/MonthCalendar";
import { MidweekMeeting } from "../../components/MidweekMeeting";
import es from "../../i18n/es.json";

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

  const meetingStartTime = config
    ? (viewMode === "midweek" ? config.midweekTime : config.weekendTime)
    : (selectedMeeting?.hora_inicio ?? "09:00");

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
          viewMode === "midweek" ? (
            <MidweekMeeting meeting={selectedMeeting} pubName={pubName} startTime={meetingStartTime} />
          ) : (
            <View>
              {/* Fim de semana — manter layout genérico por enquanto */}
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 12, paddingHorizontal: 14, backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: "#e0e0e0" }}>
                <Text style={{ fontSize: 15, color: "#333" }}>Presidente</Text>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                  <Text style={{ fontSize: 14, color: "#555" }}>
                    {selectedMeeting.parts.find((p) => p.seccion === "PRESIDENTE")?.titular_id
                      ? pubName(selectedMeeting.parts.find((p) => p.seccion === "PRESIDENTE")!.titular_id)
                      : es["Sin asignar"]}
                  </Text>
                  <Text style={{ fontSize: 14, color: "#ccc" }}>{">"}</Text>
                </View>
              </View>
            </View>
          )
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
