// Calendario — vista mensual de reuniones (iOS + Android).
// Sin dependencias externas, usa solo datos del programa.

import { useState, useMemo } from "react";
import { Text, View, TouchableOpacity, ScrollView } from "react-native";
import { usePrograma } from "../../hooks/usePrograma";
import { getCongregationId } from "../../lib/api";
import es from "../../i18n/es.json";

const DAYS = ["L", "M", "X", "J", "V", "S", "D"];
const MONTHS = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}
function getFirstDayOfWeek(year: number, month: number) {
  const d = new Date(year, month, 1).getDay();
  return d === 0 ? 6 : d - 1; // Lunes = 0
}

export default function Calendario() {
  const congId = getCongregationId();
  const { meetings } = usePrograma(congId);
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const daysInMonth = getDaysInMonth(year, month);
  const firstDay = getFirstDayOfWeek(year, month);

  const meetingDates = useMemo(() => {
    const map = new Map<string, typeof meetings>();
    for (const m of meetings) {
      const key = m.fecha; // "YYYY-MM-DD"
      const list = map.get(key) ?? [];
      list.push(m);
      map.set(key, list);
    }
    return map;
  }, [meetings]);

  const cells = useMemo(() => {
    const arr: (number | null)[] = [];
    for (let i = 0; i < firstDay; i++) arr.push(null);
    for (let d = 1; d <= daysInMonth; d++) arr.push(d);
    return arr;
  }, [firstDay, daysInMonth]);

  function prevMonth() {
    if (month === 0) { setMonth(11); setYear(year - 1); }
    else setMonth(month - 1);
    setSelectedDate(null);
  }
  function nextMonth() {
    if (month === 11) { setMonth(0); setYear(year + 1); }
    else setMonth(month + 1);
    setSelectedDate(null);
  }

  function dateKey(day: number) {
    const mm = String(month + 1).padStart(2, "0");
    const dd = String(day).padStart(2, "0");
    return `${year}-${mm}-${dd}`;
  }

  const selectedMeetings = selectedDate ? meetingDates.get(selectedDate) ?? [] : [];

  return (
    <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
      <Text style={{ fontSize: 20, fontWeight: "bold" }}>{es["Calendario"]}</Text>

      {/* Navegación mes */}
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
        <TouchableOpacity onPress={prevMonth} style={{ padding: 8 }}>
          <Text style={{ fontSize: 20 }}>◀</Text>
        </TouchableOpacity>
        <Text style={{ fontSize: 16, fontWeight: "bold" }}>{MONTHS[month]} {year}</Text>
        <TouchableOpacity onPress={nextMonth} style={{ padding: 8 }}>
          <Text style={{ fontSize: 20 }}>▶</Text>
        </TouchableOpacity>
      </View>

      {/* Cabecera días */}
      <View style={{ flexDirection: "row" }}>
        {DAYS.map((d) => (
          <View key={d} style={{ flex: 1, alignItems: "center", padding: 4 }}>
            <Text style={{ fontWeight: "bold", color: "#555", fontSize: 12 }}>{d}</Text>
          </View>
        ))}
      </View>

      {/* Grid calendario */}
      <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
        {cells.map((day, i) => {
          if (day === null) return <View key={`e${i}`} style={{ width: "14.28%", aspectRatio: 1 }} />;
          const dk = dateKey(day);
          const hasMeeting = meetingDates.has(dk);
          const isSelected = selectedDate === dk;
          return (
            <TouchableOpacity
              key={dk}
              onPress={() => setSelectedDate(isSelected ? null : dk)}
              style={{
                width: "14.28%",
                aspectRatio: 1,
                alignItems: "center",
                justifyContent: "center",
                borderRadius: 4,
                backgroundColor: isSelected ? "#0a7ea4" : hasMeeting ? "#eaf2f8" : undefined,
              }}
            >
              <Text style={{
                fontWeight: hasMeeting ? "bold" : "normal",
                color: isSelected ? "#fff" : hasMeeting ? "#0a7ea4" : "#333",
              }}>
                {day}
              </Text>
              {hasMeeting ? <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: isSelected ? "#fff" : "#0a7ea4", marginTop: 2 }} /> : null}
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Detalle día seleccionado */}
      {selectedDate && selectedMeetings.length > 0 ? (
        <View style={{ gap: 8, padding: 12, backgroundColor: "#f5f5f5", borderRadius: 8 }}>
          <Text style={{ fontWeight: "bold", fontSize: 14 }}>{selectedDate}</Text>
          {selectedMeetings.map((m) => (
            <View key={m.id} style={{ gap: 4, padding: 8, backgroundColor: "#fff", borderRadius: 6, borderWidth: 1, borderColor: "#ddd" }}>
              <Text style={{ fontWeight: "600" }}>{m.tipo} · {m.sala}</Text>
              {m.semana_label ? <Text style={{ fontSize: 12, color: "#666" }}>{m.semana_label}</Text> : null}
              {m.hora_inicio ? <Text style={{ fontSize: 12, color: "#666" }}>Inicio: {m.hora_inicio}</Text> : null}
              {m.excepcion ? <Text style={{ fontSize: 12, color: "#e67e22" }}>⚠ {m.excepcion}</Text> : null}
              <Text style={{ fontSize: 12, color: "#888" }}>
                {m.parts.filter((p) => p.titular_id).length}/{m.parts.length} partes asignadas
              </Text>
            </View>
          ))}
        </View>
      ) : selectedDate ? (
        <View style={{ padding: 12, backgroundColor: "#f5f5f5", borderRadius: 8 }}>
          <Text style={{ color: "#666" }}>{es["Sin reuniones"]}</Text>
        </View>
      ) : null}
    </ScrollView>
  );
}
