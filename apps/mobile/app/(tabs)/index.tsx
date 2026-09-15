// Home — Resumo: próxima reunião, designações, botões de acesso rápido.
// Fase 30 — iOS + Android (Expo).

import { Text, View, TouchableOpacity, ScrollView } from "react-native";
import { useRouter } from "expo-router";
import { usePrograma } from "../../hooks/usePrograma";
import { usePublishers } from "../../hooks/usePublishers";
import { useAuth } from "../../lib/auth";
import { getCongregationId } from "../../lib/api";
import { fmtDate, fmtTime, getWeekStart, calcMeetingDate, dayNameEs } from "../../lib/formatDate";
import { useQuery } from "@tanstack/react-query";
import { getConfig } from "../../lib/api";
import { SkeletonRow } from "../../components/Skeleton";
import es from "../../i18n/es.json";

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

export default function Inicio() {
  const { user, logout } = useAuth();
  const congId = user ? getCongregationId() : null;
  const { meetings, offline, isPending } = usePrograma(congId);
  const { data: publishers } = usePublishers(congId);
  const router = useRouter();

  const { data: configData } = useQuery({
    queryKey: ["config", congId],
    queryFn: () => getConfig(congId!),
    enabled: !!congId,
    retry: 1,
    staleTime: 0,
  });
  const config: MeetingConfig | null = configData?.config ?? null;

  const today = todayStr();
  const currentWeekStart = getWeekStart(today);

  // Encontrar reuniões da semana atual
  const weekMeetings = meetings.filter((m) => getWeekStart(m.fecha) === currentWeekStart);
  const midweekMeeting = weekMeetings.find((m) => m.tipo === "entre_semana");
  const weekendMeeting = weekMeetings.find((m) => m.tipo === "fin_semana");

  // Calcular datas reais baseado na config
  let nextMeeting = null;
  let nextMeetingType = "";
  let nextMeetingDate = "";
  let nextMeetingDay = "";
  let nextMeetingTime = "";

  if (midweekMeeting && config) {
    const midDate = calcMeetingDate(currentWeekStart, config.midweekDay);
    if (midDate >= today) {
      nextMeeting = midweekMeeting;
      nextMeetingType = "entre_semana";
      nextMeetingDate = midDate;
      nextMeetingDay = dayNameEs(config.midweekDay);
      nextMeetingTime = config.midweekTime;
    }
  }

  if (!nextMeeting && weekendMeeting && config) {
    const weekendDate = calcMeetingDate(currentWeekStart, config.weekendDay);
    if (weekendDate >= today) {
      nextMeeting = weekendMeeting;
      nextMeetingType = "fin_semana";
      nextMeetingDate = weekendDate;
      nextMeetingDay = dayNameEs(config.weekendDay);
      nextMeetingTime = config.weekendTime;
    }
  }

  // Se não encontrou na semana atual, buscar próxima
  if (!nextMeeting) {
    const sorted = [...meetings].sort((a, b) => a.fecha.localeCompare(b.fecha));
    nextMeeting = sorted.find((m) => m.fecha >= today) ?? null;
    if (nextMeeting) {
      const wkStart = getWeekStart(nextMeeting.fecha);
      const dayOfWeek = nextMeeting.tipo === "entre_semana" ? config?.midweekDay : config?.weekendDay;
      if (dayOfWeek) {
        nextMeetingDate = calcMeetingDate(wkStart, dayOfWeek);
        nextMeetingDay = dayNameEs(dayOfWeek);
        nextMeetingTime = (nextMeeting.tipo === "entre_semana" ? config?.midweekTime : config?.weekendTime) ?? "";
      } else {
        nextMeetingDate = nextMeeting.fecha;
        const d = new Date(nextMeeting.fecha + "T00:00:00");
        nextMeetingDay = dayNameEs(d.getDay() + 1);
      }
      nextMeetingType = nextMeeting.tipo;
    }
  }

  // Verificar se o usuário tem designação na próxima reunião
  const userHasAssignment = nextMeeting
    ? nextMeeting.parts.some((p) => p.titular_id && p.titular_id === user?.id)
    : false;

  // Contar partes designadas vs total
  const currentWeekAssigned = weekMeetings.reduce(
    (acc, m) => acc + m.parts.filter((p) => p.titular_id).length,
    0
  );
  const currentWeekTotal = weekMeetings.reduce(
    (acc, m) => acc + m.parts.filter((p) => p.tipo_clave !== "cancion_inicial" && p.tipo_clave !== "cancion_intermedia" && p.tipo_clave !== "cancion_final").length,
    0
  );

  const tipoLabel = nextMeetingType === "entre_semana"
    ? es["Reunión entre semana"]
    : nextMeetingType === "fin_semana"
    ? es["Reunión fin de semana"]
    : "";

  return (
    <ScrollView contentContainerStyle={{ padding: 16, gap: 16 }}>
      {offline ? (
        <Text style={{ fontSize: 12, color: "#e74c3c" }}>{es["Sin conexión"]}</Text>
      ) : null}

      {isPending ? <SkeletonRow lines={3} /> : null}

      {/* Próxima reunião */}
      <View
        style={{
          padding: 16,
          backgroundColor: "#eaf2f8",
          borderRadius: 12,
          borderWidth: 1,
          borderColor: "#aed6f1",
          gap: 8,
        }}
      >
        <Text style={{ fontSize: 13, fontWeight: "600", color: "#555" }}>{es["Próxima reunión"]}</Text>
        {nextMeeting ? (
          <>
            <Text style={{ fontSize: 18, fontWeight: "bold", color: "#1a5276" }}>
              {tipoLabel}
            </Text>
            <Text style={{ fontSize: 15, color: "#333" }}>
              {nextMeetingDay} {fmtDate(nextMeetingDate)}
              {nextMeetingTime ? ` · ${nextMeetingTime}` : ""}
            </Text>
            {nextMeeting.semana_label ? (
              <Text style={{ fontSize: 13, color: "#666" }}>{nextMeeting.semana_label}</Text>
            ) : null}
          </>
        ) : (
          <Text style={{ fontSize: 14, color: "#888" }}>{es["Sin reuniones todavía"]}</Text>
        )}
      </View>

      {/* Designações do usuário */}
      <View
        style={{
          padding: 16,
          backgroundColor: userHasAssignment ? "#eafaf1" : "#fef9e7",
          borderRadius: 12,
          borderWidth: 1,
          borderColor: userHasAssignment ? "#a9dfbf" : "#f9e79f",
          gap: 4,
        }}
      >
        <Text style={{ fontSize: 13, fontWeight: "600", color: "#555" }}>{es["Tu asignación"]}</Text>
        <Text style={{ fontSize: 15, fontWeight: "600", color: userHasAssignment ? "#27ae60" : "#f39c12" }}>
          {userHasAssignment ? es["Tiene asignación"] : es["Sin asignación pendiente"]}
        </Text>
      </View>

      {/* Progresso da semana */}
      <View
        style={{
          padding: 16,
          backgroundColor: "#f5f5f5",
          borderRadius: 12,
          borderWidth: 1,
          borderColor: "#e0e0e0",
          gap: 4,
        }}
      >
        <Text style={{ fontSize: 13, fontWeight: "600", color: "#555" }}>{es["Asignaciones"]}</Text>
        <Text style={{ fontSize: 24, fontWeight: "bold", color: "#1a5276" }}>
          {currentWeekAssigned} / {currentWeekTotal}
        </Text>
        <Text style={{ fontSize: 13, color: "#777" }}>
          {currentWeekTotal - currentWeekAssigned > 0
            ? `${currentWeekTotal - currentWeekAssigned} partes sin asignar`
            : "Todas asignadas ✓"}
        </Text>
      </View>

      {/* Botões de acesso rápido */}
      <View style={{ gap: 8 }}>
        <Text style={{ fontSize: 13, fontWeight: "600", color: "#555" }}>{es["Accesos rápidos"]}</Text>

        <TouchableOpacity
          onPress={() => router.push("/(tabs)/programa")}
          style={{
            padding: 14,
            backgroundColor: "#fff",
            borderRadius: 10,
            borderWidth: 1,
            borderColor: "#e0e0e0",
            flexDirection: "row",
            alignItems: "center",
            gap: 10,
          }}
        >
          <Text style={{ fontSize: 18 }}>{"\u{1F4C5}"}</Text>
          <Text style={{ fontSize: 15, fontWeight: "500", flex: 1 }}>{es["Ver programa"]}</Text>
          <Text style={{ fontSize: 16, color: "#ccc" }}>{">"}</Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => router.push("/(tabs)/designacoes")}
          style={{
            padding: 14,
            backgroundColor: "#fff",
            borderRadius: 10,
            borderWidth: 1,
            borderColor: "#e0e0e0",
            flexDirection: "row",
            alignItems: "center",
            gap: 10,
          }}
        >
          <Text style={{ fontSize: 18 }}>{"\u{270D}\u{FE0F}"}</Text>
          <Text style={{ fontSize: 15, fontWeight: "500", flex: 1 }}>{es["Designações"]}</Text>
          <Text style={{ fontSize: 16, color: "#ccc" }}>{">"}</Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => router.push("/(tabs)/config")}
          style={{
            padding: 14,
            backgroundColor: "#fff",
            borderRadius: 10,
            borderWidth: 1,
            borderColor: "#e0e0e0",
            flexDirection: "row",
            alignItems: "center",
            gap: 10,
          }}
        >
          <Text style={{ fontSize: 18 }}>{"\u{2699}\u{FE0F}"}</Text>
          <Text style={{ fontSize: 15, fontWeight: "500", flex: 1 }}>{es["Configuración"]}</Text>
          <Text style={{ fontSize: 16, color: "#ccc" }}>{">"}</Text>
        </TouchableOpacity>
      </View>

      {/* Usuário */}
      {user ? (
        <View
          style={{
            padding: 14,
            backgroundColor: "#f5f5f5",
            borderRadius: 10,
            gap: 4,
          }}
        >
          <Text style={{ fontSize: 13, color: "#888" }}>{user.nombre}</Text>
          <Text style={{ fontSize: 12, color: "#aaa" }}>{user.email}</Text>
        </View>
      ) : null}
    </ScrollView>
  );
}
