import { useState, useMemo } from "react";
import { Button, ScrollView, Text, View, TouchableOpacity } from "react-native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../../lib/auth";
import { getCongregationId, isNetworkError, publishMeeting, getConfig } from "../../lib/api";
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

  // Ordenar: meio de semana primeiro, depois fim de semana
  const sortFn = (a: ProgramaMeeting, b: ProgramaMeeting) => {
    if (a.tipo === "entre_semana" && b.tipo === "fin_semana") return -1;
    if (a.tipo === "fin_semana" && b.tipo === "entre_semana") return 1;
    return a.fecha.localeCompare(b.fecha);
  };

  return {
    current: current.sort(sortFn),
    future: future.sort(sortFn),
    past: past.sort(sortFn),
  };
}

function MeetingCard({
  m,
  pubName,
  expanded,
  onToggle,
  isPast,
  pubMut,
  offline,
  config,
}: {
  m: ProgramaMeeting;
  pubName: (id: string | null) => string;
  expanded: boolean;
  onToggle: () => void;
  isPast: boolean;
  pubMut: ReturnType<typeof useMutation>;
  offline: boolean;
  config: MeetingConfig | null;
}) {
  const salas = new Set(m.parts.map((p) => p.sala));
  const assigned = m.parts.filter((p) => p.titular_id).length;
  const total = m.parts.filter((p) => p.tipo_clave !== "cancion_inicial" && p.tipo_clave !== "cancion_intermedia" && p.tipo_clave !== "cancion_final").length;
  const isComplete = total > 0 && assigned >= total;
  const tipoLabel = MEETING_TYPE_LABELS[m.tipo] ?? m.tipo;

  // Calcular a data da reunião baseado na config
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

  // Hora da reunião baseado na config
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
        borderColor: isPast ? "#ccc" : isComplete ? "#27ae60" : "#e74c3c",
        backgroundColor: isPast ? "#fafafa" : isComplete ? "#eafaf1" : "#fef9e7",
        gap: 4,
      }}
    >
      <TouchableOpacity onPress={onToggle}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={{ fontWeight: "bold", fontSize: 14 }}>
              {tipoLabel}
            </Text>
            <Text style={{ fontSize: 13, color: "#333" }}>
              {displayDay} {fmtDate(displayDate)}
              {meetingTime ? ` \u00B7 ${fmtTime(meetingTime)}` : ""}
              {m.semana_label ? ` \u00B7 ${m.semana_label}` : ""}
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
            <Text style={{ fontSize: 10, color: "#888" }}>{expanded ? "\u25B2" : "\u25BC"}</Text>
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
              .join(" \u00B7 ")}
          </Text>
        ) : null}
        <Text style={{ fontSize: 11, color: isComplete ? "#27ae60" : "#888", marginTop: 2 }}>
          {estadoLabel(m.estado)}
          {isPast ? " \u00B7 " + es["Ver reunión pasada"] : ""}
        </Text>
      </TouchableOpacity>

      {expanded
        ? m.parts.map((p) => (
            <View key={p.id} style={{ paddingLeft: 8, paddingVertical: 4, gap: 2, borderLeftWidth: 2, borderLeftColor: p.titular_id ? "#27ae60" : "#e74c3c", marginLeft: 4 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                <View style={{ backgroundColor: salaColor(p.sala), borderRadius: 4, paddingHorizontal: 3, paddingVertical: 1 }}>
                  <Text style={{ color: "#fff", fontSize: 9, fontWeight: "bold" }}>{p.sala}</Text>
                </View>
                <Text style={{ fontSize: 13 }}>
                  {p.hora_inicio ? fmtTime(p.hora_inicio) : ""}
                  {p.hora_fin ? ` - ${fmtTime(p.hora_fin)}` : ""}
                  {p.hora_inicio || p.hora_fin ? " \u00B7 " : ""}
                  {p.orden}. {p.titulo}
                  {p.duracion_min ? ` (${p.duracion_min} min)` : ""}
                </Text>
              </View>
              <Text style={{ paddingLeft: 16, fontSize: 12, color: p.titular_id ? "#333" : "#e74c3c" }}>
                {es["Titular"]}:{" "}
                {p.titular_id ? pubName(p.titular_id) : es["Sin asignar"]}
                {p.ayudante_id ? ` \u00B7 ${es["Ayudante"]}: ${pubName(p.ayudante_id)}` : ""}
              </Text>
              {p.warnings.map((w) => (
                <Text key={w.id} style={{ paddingLeft: 16, fontSize: 11, color: "#e67e22" }}>
                  \u26A0 {w.mensaje_es}
                </Text>
              ))}
            </View>
          ))
        : null}

      {expanded && !isPast && m.estado !== "published" ? (
        <Button
          title={pubMut.isPending ? es["Publicando..."] : es["Publicar"]}
          onPress={() => pubMut.mutate(m.id)}
          disabled={pubMut.isPending || offline}
        />
      ) : null}
    </View>
  );
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
  const [showPast, setShowPast] = useState(false);

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

  const { current, future, past } = useMemo(() => classifyMeetings(meetings, config), [meetings, config]);

  return (
    <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
      <Text style={{ fontSize: 20, fontWeight: "bold" }}>{es["Programa"]}</Text>

      <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
        <Button
          title={isFetching ? es["Sincronizando..."] : es["Sincronizar"]}
          onPress={() => { setPublishMsg(null); refetch(); }}
          disabled={isFetching}
        />
      </View>
      {offline ? <Text style={{ color: "#e74c3c" }}>{es["Sin conexión — verifique la IP del servidor"]}</Text> : null}
      {lastSync && !offline ? <Text style={{ fontSize: 12, color: "#666" }}>{es["Sincronizado"]}: {fmtLastSync(lastSync)}</Text> : null}

      {isPending ? <SkeletonRow lines={5} /> : null}
      {isError && meetings.length === 0 ? (
        <Text>{(error as Error)?.message ?? es["Error al cargar el programa"]}</Text>
      ) : null}
      {!isPending && meetings.length === 0 ? <Text>{es["Sin reuniones todavía"]}</Text> : null}
      {publishMsg ? <Text style={{ color: "#e74c3c" }}>{publishMsg}</Text> : null}

      {current.length > 0 ? (
        <View style={{ gap: 6 }}>
          <Text style={{ fontWeight: "bold", fontSize: 15, color: "#1a5276" }}>
            {es["Semana actual"]}
          </Text>
          {current.map((m) => (
            <MeetingCard
              key={m.id}
              m={m}
              pubName={pubName}
              expanded={expanded === m.id}
              onToggle={() => setExpanded(expanded === m.id ? null : m.id)}
              isPast={false}
              pubMut={pub}
              offline={offline}
              config={config}
            />
          ))}
        </View>
      ) : null}

      {future.length > 0 ? (
        <View style={{ gap: 6 }}>
          <Text style={{ fontWeight: "bold", fontSize: 15, color: "#7d3c98" }}>
            {es["Próximas reuniones"]}
          </Text>
          {future.map((m) => (
            <MeetingCard
              key={m.id}
              m={m}
              pubName={pubName}
              expanded={expanded === m.id}
              onToggle={() => setExpanded(expanded === m.id ? null : m.id)}
              isPast={false}
              pubMut={pub}
              offline={offline}
              config={config}
            />
          ))}
        </View>
      ) : null}

      {past.length > 0 ? (
        <View style={{ gap: 6 }}>
          <TouchableOpacity onPress={() => setShowPast(!showPast)}>
            <Text style={{ fontWeight: "bold", fontSize: 15, color: "#888" }}>
              {showPast ? "\u25B2" : "\u25BC"} {es["Reuniones pasadas"]} ({past.length})
            </Text>
          </TouchableOpacity>
          {showPast
            ? past.map((m) => (
                <MeetingCard
                  key={m.id}
                  m={m}
                  pubName={pubName}
                  expanded={expanded === m.id}
                  onToggle={() => setExpanded(expanded === m.id ? null : m.id)}
                  isPast={true}
                  pubMut={pub}
                  offline={offline}
                  config={config}
                />
              ))
            : null}
        </View>
      ) : null}
    </ScrollView>
  );
}
