// Tela de Configuração: horários, eventos especiais, exceções de agenda.
// Fase 30 — iOS + Android (Expo).

import { useState, useEffect, useCallback } from "react";
import { Button, ScrollView, Text, View, TouchableOpacity, Alert, TextInput } from "react-native";
import { useRouter } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import es from "../../i18n/es.json";
import {
  getConfig,
  saveConfig,
  createEvent,
  deleteEvent,
  createException,
  deleteException,
  type MeetingConfig,
  type SpecialEvent,
  type ScheduleException,
} from "../../lib/api";
import { getCongregationId, isNetworkError } from "../../lib/api";
import { fmtDate } from "../../lib/formatDate";

const DAY_OPTIONS = [
  { value: 1, label: es["Domingo"] },
  { value: 2, label: es["Lunes"] },
  { value: 3, label: es["Martes"] },
  { value: 4, label: es["Miércoles"] },
  { value: 5, label: es["Jueves"] },
  { value: 6, label: es["Viernes"] },
  { value: 7, label: es["Sábado"] },
];

const EVENT_TYPES = [
  { value: "congreso", label: es["Congreso"] },
  { value: "asamblea_regional", label: es["Asamblea Regional"] },
  { value: "asamblea_viajante", label: es["Asamblea con Viajante"] },
  { value: "asamblea_representante", label: es["Asamblea con Representante"] },
  { value: "celebracion", label: es["Celebración"] },
  { value: "visita_co", label: es["Visita del CO"] },
  { value: "otro", label: es["Otro"] },
];

const EXCEPTION_TYPES = [
  { value: "sin_reunion", label: es["Sin reunión"] },
  { value: "horario_modificado", label: es["Horario modificado"] },
  { value: "reunion_especial", label: es["Reunión especial"] },
];

function DayPicker({
  selected,
  onSelect,
}: {
  selected: number;
  onSelect: (day: number) => void;
}) {
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
      {DAY_OPTIONS.map((d) => (
        <TouchableOpacity
          key={d.value}
          onPress={() => onSelect(d.value)}
          style={{
            paddingVertical: 6,
            paddingHorizontal: 10,
            borderRadius: 6,
            borderWidth: 1,
            borderColor: selected === d.value ? "#0a7ea4" : "#ccc",
            backgroundColor: selected === d.value ? "#eaf2f8" : "#fff",
          }}
        >
          <Text style={{ fontSize: 13, color: selected === d.value ? "#0a7ea4" : "#333" }}>
            {d.label}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

function EventForm({
  congId,
  onSuccess,
}: {
  congId: string;
  onSuccess: () => void;
}) {
  const [tipo, setTipo] = useState("congreso");
  const [titulo, setTitulo] = useState("");
  const [fechaInicio, setFechaInicio] = useState("");
  const [fechaFin, setFechaFin] = useState("");
  const [horaInicio, setHoraInicio] = useState("");
  const [notas, setNotas] = useState("");

  const mut = useMutation({
    mutationFn: () =>
      createEvent(congId, {
        tipo,
        titulo,
        fechaInicio,
        fechaFin: fechaFin || null,
        horaInicio: horaInicio || null,
        notas: notas || null,
      }),
    onSuccess: () => {
      setTipo("congreso");
      setTitulo("");
      setFechaInicio("");
      setFechaFin("");
      setHoraInicio("");
      setNotas("");
      onSuccess();
    },
  });

  return (
    <View style={{ gap: 6, padding: 10, backgroundColor: "#f5f5f5", borderRadius: 8 }}>
      <Text style={{ fontWeight: "600" }}>{es["Nuevo evento"]}</Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
        {EVENT_TYPES.map((et) => (
          <TouchableOpacity
            key={et.value}
            onPress={() => setTipo(et.value)}
            style={{
              paddingVertical: 4,
              paddingHorizontal: 8,
              borderRadius: 4,
              borderWidth: 1,
              borderColor: tipo === et.value ? "#0a7ea4" : "#ccc",
              backgroundColor: tipo === et.value ? "#eaf2f8" : "#fff",
            }}
          >
            <Text style={{ fontSize: 12, color: tipo === et.value ? "#0a7ea4" : "#333" }}>
              {et.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
      <Text style={{ fontSize: 12, color: "#555" }}>{es["Título"]}</Text>
      <TextInput
        style={{ borderWidth: 1, borderColor: "#ccc", borderRadius: 4, padding: 8, fontSize: 14 }}
        value={titulo}
        onChangeText={setTitulo}
        placeholder="Nombre del evento"
      />
      <Text style={{ fontSize: 12, color: "#555" }}>{es["Fecha de inicio"]} (YYYY-MM-DD)</Text>
      <TextInput
        style={{ borderWidth: 1, borderColor: "#ccc", borderRadius: 4, padding: 8, fontSize: 14 }}
        value={fechaInicio}
        onChangeText={setFechaInicio}
        placeholder="2026-09-15"
      />
      <Text style={{ fontSize: 12, color: "#555" }}>{es["Fecha de fin"]} (opcional)</Text>
      <TextInput
        style={{ borderWidth: 1, borderColor: "#ccc", borderRadius: 4, padding: 8, fontSize: 14 }}
        value={fechaFin}
        onChangeText={setFechaFin}
        placeholder="2026-09-17"
      />
      <Text style={{ fontSize: 12, color: "#555" }}>{es["Hora de inicio"]} (HH:MM)</Text>
      <TextInput
        style={{ borderWidth: 1, borderColor: "#ccc", borderRadius: 4, padding: 8, fontSize: 14 }}
        value={horaInicio}
        onChangeText={setHoraInicio}
        placeholder="09:00"
      />
      <Text style={{ fontSize: 12, color: "#555" }}>Notas (opcional)</Text>
      <TextInput
        style={{ borderWidth: 1, borderColor: "#ccc", borderRadius: 4, padding: 8, fontSize: 14 }}
        value={notas}
        onChangeText={setNotas}
        placeholder="Información adicional"
      />
      <Button
        title={mut.isPending ? es["Creando..."] : es["Crear evento"]}
        onPress={() => mut.mutate()}
        disabled={mut.isPending || !titulo || !fechaInicio}
      />
      {mut.isError ? <Text style={{ color: "red", fontSize: 12 }}>{(mut.error as Error).message}</Text> : null}
    </View>
  );
}

function ExceptionForm({
  congId,
  onSuccess,
}: {
  congId: string;
  onSuccess: () => void;
}) {
  const [tipo, setTipo] = useState("sin_reunion");
  const [fecha, setFecha] = useState("");
  const [horaInicio, setHoraInicio] = useState("");
  const [notas, setNotas] = useState("");

  const mut = useMutation({
    mutationFn: () =>
      createException(congId, {
        fecha,
        tipo,
        horaInicio: horaInicio || null,
        notas: notas || null,
      }),
    onSuccess: () => {
      setTipo("sin_reunion");
      setFecha("");
      setHoraInicio("");
      setNotas("");
      onSuccess();
    },
  });

  return (
    <View style={{ gap: 6, padding: 10, backgroundColor: "#f5f5f5", borderRadius: 8 }}>
      <Text style={{ fontWeight: "600" }}>{es["Nueva excepción"]}</Text>
      <Text style={{ fontSize: 12, color: "#555" }}>{es["Tipo de excepción"]}</Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
        {EXCEPTION_TYPES.map((et) => (
          <TouchableOpacity
            key={et.value}
            onPress={() => setTipo(et.value)}
            style={{
              paddingVertical: 4,
              paddingHorizontal: 8,
              borderRadius: 4,
              borderWidth: 1,
              borderColor: tipo === et.value ? "#0a7ea4" : "#ccc",
              backgroundColor: tipo === et.value ? "#eaf2f8" : "#fff",
            }}
          >
            <Text style={{ fontSize: 12, color: tipo === et.value ? "#0a7ea4" : "#333" }}>
              {et.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
      <Text style={{ fontSize: 12, color: "#555" }}>{es["Fecha"]} (YYYY-MM-DD)</Text>
      <TextInput
        style={{ borderWidth: 1, borderColor: "#ccc", borderRadius: 4, padding: 8, fontSize: 14 }}
        value={fecha}
        onChangeText={setFecha}
        placeholder="2026-09-15"
      />
      {tipo === "horario_modificado" ? (
        <>
          <Text style={{ fontSize: 12, color: "#555" }}>{es["Hora de inicio"]} (HH:MM)</Text>
          <TextInput
            style={{ borderWidth: 1, borderColor: "#ccc", borderRadius: 4, padding: 8, fontSize: 14 }}
            value={horaInicio}
            onChangeText={setHoraInicio}
            placeholder="19:00"
          />
        </>
      ) : null}
      <Text style={{ fontSize: 12, color: "#555" }}>Notas (opcional)</Text>
      <TextInput
        style={{ borderWidth: 1, borderColor: "#ccc", borderRadius: 4, padding: 8, fontSize: 14 }}
        value={notas}
        onChangeText={setNotas}
        placeholder="Información adicional"
      />
      <Button
        title={mut.isPending ? es["Creando..."] : es["Crear excepción"]}
        onPress={() => mut.mutate()}
        disabled={mut.isPending || !fecha}
      />
      {mut.isError ? <Text style={{ color: "red", fontSize: 12 }}>{(mut.error as Error).message}</Text> : null}
    </View>
  );
}

export default function ConfigScreen() {
  const congId = getCongregationId();
  const client = useQueryClient();
  const router = useRouter();

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["config", congId],
    queryFn: () => getConfig(congId),
    enabled: !!congId,
    retry: 1,
    staleTime: 0,
  });

  const [midweekDay, setMidweekDay] = useState(3);
  const [midweekTime, setMidweekTime] = useState("19:00");
  const [weekendDay, setWeekendDay] = useState(1);
  const [weekendTime, setWeekendTime] = useState("10:00");
  const [saveMsg, setSaveMsg] = useState<string | null>(null);

  useEffect(() => {
    if (data?.config) {
      setMidweekDay(data.config.midweekDay);
      setMidweekTime(data.config.midweekTime);
      setWeekendDay(data.config.weekendDay);
      setWeekendTime(data.config.weekendTime);
    }
  }, [data?.config]);

  const saveMut = useMutation({
    mutationFn: () =>
      saveConfig(congId, { midweekDay, midweekTime, weekendDay, weekendTime }),
    onSuccess: async () => {
      setSaveMsg(es["Horarios guardados"]);
      await client.invalidateQueries({ queryKey: ["config", congId] });
    },
    onError: (e) => setSaveMsg((e as Error).message),
  });

  const delEventMut = useMutation({
    mutationFn: (eventId: string) => deleteEvent(congId, eventId),
    onSuccess: () => client.invalidateQueries({ queryKey: ["config", congId] }),
  });

  const delExcMut = useMutation({
    mutationFn: (excId: string) => deleteException(congId, excId),
    onSuccess: () => client.invalidateQueries({ queryKey: ["config", congId] }),
  });

  const config = data?.config;
  const events = data?.events ?? [];
  const exceptions = data?.exceptions ?? [];

  return (
    <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
      {isLoading ? <Text>Cargando...</Text> : null}

      <View style={{ gap: 8, padding: 12, backgroundColor: "#eaf2f8", borderRadius: 8, borderWidth: 1, borderColor: "#aed6f1" }}>
        <Text style={{ fontWeight: "bold", fontSize: 15 }}>{es["Horarios de reuniones"]}</Text>

        <Text style={{ fontWeight: "600", marginTop: 4 }}>{es["Reunión entre semana"]}</Text>
        <Text style={{ fontSize: 12, color: "#555" }}>{es["Día de la reunión entre semana"]}</Text>
        <DayPicker selected={midweekDay} onSelect={setMidweekDay} />
        <Text style={{ fontSize: 12, color: "#555" }}>{es["Hora de inicio"]}</Text>
        <TextInput
          style={{ borderWidth: 1, borderColor: "#ccc", borderRadius: 4, padding: 8, fontSize: 14 }}
          value={midweekTime}
          onChangeText={setMidweekTime}
          placeholder="19:00"
        />

        <Text style={{ fontWeight: "600", marginTop: 8 }}>{es["Reunión fin de semana"]}</Text>
        <Text style={{ fontSize: 12, color: "#555" }}>{es["Día de la reunión fin de semana"]}</Text>
        <DayPicker selected={weekendDay} onSelect={setWeekendDay} />
        <Text style={{ fontSize: 12, color: "#555" }}>{es["Hora de inicio"]}</Text>
        <TextInput
          style={{ borderWidth: 1, borderColor: "#ccc", borderRadius: 4, padding: 8, fontSize: 14 }}
          value={weekendTime}
          onChangeText={setWeekendTime}
          placeholder="10:00"
        />

        <Button
          title={saveMut.isPending ? es["Guardando..."] : es["Guardar horarios"]}
          onPress={() => saveMut.mutate()}
          disabled={saveMut.isPending}
        />
        {saveMsg ? <Text style={{ fontSize: 12, color: "#27ae60" }}>{saveMsg}</Text> : null}
      </View>

      <View style={{ gap: 8, padding: 12, backgroundColor: "#fef9e7", borderRadius: 8, borderWidth: 1, borderColor: "#f9e79f" }}>
        <Text style={{ fontWeight: "bold", fontSize: 15 }}>{es["Eventos especiales"]}</Text>
        {events.length === 0 ? (
          <Text style={{ fontSize: 12, color: "#888" }}>Sin eventos especiales</Text>
        ) : null}
        {events.map((ev) => (
          <View key={ev.id} style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 4, borderBottomWidth: 1, borderColor: "#eee" }}>
            <View style={{ flex: 1 }}>
              <Text style={{ fontWeight: "600", fontSize: 13 }}>{ev.titulo}</Text>
              <Text style={{ fontSize: 12, color: "#555" }}>
                {ev.fechaInicio}{ev.fechaFin ? ` - ${ev.fechaFin}` : ""}
                {ev.horaInicio ? ` ${ev.horaInicio}` : ""}
              </Text>
            </View>
            <Button
              title="X"
              onPress={() => {
                Alert.alert("Eliminar", `¿Eliminar "${ev.titulo}"?`, [
                  { text: es["Cancelar"], style: "cancel" },
                  { text: es["Eliminar"], style: "destructive", onPress: () => delEventMut.mutate(ev.id) },
                ]);
              }}
              color="#e74c3c"
            />
          </View>
        ))}
        <EventForm congId={congId} onSuccess={() => refetch()} />
      </View>

      <View style={{ gap: 8, padding: 12, backgroundColor: "#fef9e7", borderRadius: 8, borderWidth: 1, borderColor: "#f9e79f" }}>
        <Text style={{ fontWeight: "bold", fontSize: 15 }}>{es["Excepciones de agenda"]}</Text>
        {exceptions.length === 0 ? (
          <Text style={{ fontSize: 12, color: "#888" }}>Sin excepciones</Text>
        ) : null}
        {exceptions.map((ex) => (
          <View key={ex.id} style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 4, borderBottomWidth: 1, borderColor: "#eee" }}>
            <View style={{ flex: 1 }}>
              <Text style={{ fontWeight: "600", fontSize: 13 }}>
                {fmtDate(ex.fecha)} — {EXCEPTION_TYPES.find((t) => t.value === ex.tipo)?.label ?? ex.tipo}
              </Text>
              {ex.horaInicio ? <Text style={{ fontSize: 12, color: "#555" }}>{es["Hora de inicio"]}: {ex.horaInicio}</Text> : null}
              {ex.notas ? <Text style={{ fontSize: 12, color: "#555" }}>{ex.notas}</Text> : null}
            </View>
            <Button
              title="X"
              onPress={() => {
                Alert.alert("Eliminar", `¿Eliminar excepción del ${fmtDate(ex.fecha)}?`, [
                  { text: es["Cancelar"], style: "cancel" },
                  { text: es["Eliminar"], style: "destructive", onPress: () => delExcMut.mutate(ex.id) },
                ]);
              }}
              color="#e74c3c"
            />
          </View>
        ))}
        <ExceptionForm congId={congId} onSuccess={() => refetch()} />
      </View>

      <View style={{ gap: 8, padding: 12, backgroundColor: "#eaf2f8", borderRadius: 8, borderWidth: 1, borderColor: "#aed6f1" }}>
        <Text style={{ fontWeight: "bold", fontSize: 15 }}>{es["Ajustes"]}</Text>
        <TouchableOpacity
          onPress={() => router.push("/(tabs)/ausencias")}
          style={{ padding: 12, backgroundColor: "#fff", borderRadius: 6, borderWidth: 1, borderColor: "#ddd" }}
        >
          <Text style={{ fontSize: 14 }}>{es["Ausencias"]}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => router.push("/(tabs)/visits")}
          style={{ padding: 12, backgroundColor: "#fff", borderRadius: 6, borderWidth: 1, borderColor: "#ddd" }}
        >
          <Text style={{ fontSize: 14 }}>{es["Visitas"]}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => router.push("/(tabs)/profile")}
          style={{ padding: 12, backgroundColor: "#fff", borderRadius: 6, borderWidth: 1, borderColor: "#ddd" }}
        >
          <Text style={{ fontSize: 14 }}>{es["Perfil"]}</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}
