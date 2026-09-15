import { useState } from "react";
import { Text, View, TouchableOpacity, Modal } from "react-native";
import { getWeekStart } from "../lib/formatDate";
import es from "../i18n/es.json";
import type { ProgramaMeeting } from "../lib/dbPrograma";

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

export function MonthCalendar({
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
      date: dateStr, dayNum: d, isCurrentMonth: true,
      isToday: dateStr === today, isMeetingDay: meetingDates.has(dateStr),
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
