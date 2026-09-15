import { useState } from "react";
import { Button, FlatList, Text, TextInput, View, Alert } from "react-native";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { API_URL, authHeaders, getCongregationId, isNetworkError } from "../../lib/api";
import { fmtDate } from "../../lib/formatDate";
import { SearchBar } from "../../components/SearchBar";
import { SkeletonRow } from "../../components/Skeleton";
import es from "../../i18n/es.json";

interface Speaker { id: string; nombre: string; talkNumbers: number[]; }
interface Visit { id: string; speakerId: string; fecha: string; talkNumber?: number; notas?: string; estado: string; }

const ESTADO_LABELS: Record<string, string> = {
  pendiente: es["Pendiente"],
  confirmada: es["Confirmada"],
  realizada: es["Realizada"],
};

export default function VisitsScreen() {
  const congId = getCongregationId();
  const queryClient = useQueryClient();
  const [speakerId, setSpeakerId] = useState("");
  const [fecha, setFecha] = useState("");
  const [talkNumber, setTalkNumber] = useState("");
  const [notas, setNotas] = useState("");
  const [estado, setEstado] = useState<string>("pendiente");
  const [showForm, setShowForm] = useState(false);
  const [search, setSearch] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);

  const speakers = useQuery({
    queryKey: ["speakers", congId],
    queryFn: async () => {
      const res = await fetch(`${API_URL}/c/${congId}/speakers`, { headers: authHeaders() });
      const body = await res.json();
      return (body.speakers ?? []) as Speaker[];
    },
  });

  const visits = useQuery({
    queryKey: ["visits", congId],
    queryFn: async () => {
      const res = await fetch(`${API_URL}/c/${congId}/visits`, { headers: authHeaders() });
      const body = await res.json();
      return (body.visits ?? []) as Visit[];
    },
  });

  const create = useMutation({
    mutationFn: async (data: { speaker_id: string; fecha: string; talk_number?: number; notas?: string }) => {
      const res = await fetch(`${API_URL}/c/${congId}/visits`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify(data),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? es["Error al crear"]);
      return body.visit;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["visits", congId] });
      resetForm();
    },
    onError: (e) => {
      const msg = isNetworkError(e) ? es["Sin conexión. Intente más tarde."] : (e as Error).message;
      Alert.alert(es["Error"], msg);
    },
  });

  const update = useMutation({
    mutationFn: async (data: { id: string; estado?: string; notas?: string; talk_number?: number }) => {
      const res = await fetch(`${API_URL}/c/${congId}/visits/${data.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify(data),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? es["Error al crear"]);
      return body.visit;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["visits", congId] });
      resetForm();
    },
    onError: (e) => {
      const msg = isNetworkError(e) ? es["Sin conexión. Intente más tarde."] : (e as Error).message;
      Alert.alert(es["Error"], msg);
    },
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`${API_URL}/c/${congId}/visits/${id}`, { method: "DELETE", headers: authHeaders() });
      if (!res.ok) throw new Error(es["Error al eliminar"]);
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["visits", congId] }); },
    onError: (e) => {
      const msg = isNetworkError(e) ? es["Sin conexión. Intente más tarde."] : (e as Error).message;
      Alert.alert(es["Error"], msg);
    },
  });

  function resetForm() {
    setSpeakerId("");
    setFecha("");
    setTalkNumber("");
    setNotas("");
    setEstado("pendiente");
    setShowForm(false);
    setEditingId(null);
  }

  function handleCreate() {
    if (!speakerId || !fecha.trim()) { Alert.alert(es["Error"], es["Falante y fecha requeridos"]); return; }
    const payload: { speaker_id: string; fecha: string; talk_number?: number; notas?: string } = {
      speaker_id: speakerId,
      fecha: fecha.trim(),
      notas: notas || undefined,
    };
    if (talkNumber.trim()) {
      const num = parseInt(talkNumber.trim(), 10);
      if (!isNaN(num) && num > 0) payload.talk_number = num;
    }
    if (editingId) {
      update.mutate({ id: editingId, ...payload, estado });
    } else {
      create.mutate(payload);
    }
  }

  function handleEdit(v: Visit) {
    setEditingId(v.id);
    setSpeakerId(v.speakerId);
    setFecha(v.fecha);
    setTalkNumber(v.talkNumber ? String(v.talkNumber) : "");
    setNotas(v.notas ?? "");
    setEstado(v.estado);
    setShowForm(true);
  }

  function getSpeakerName(id: string): string {
    return speakers.data?.find((s) => s.id === id)?.nombre ?? es["Desconocido"];
  }

  const filtered = (visits.data ?? []).filter(
    (v) => !search || getSpeakerName(v.speakerId).toLowerCase().includes(search.toLowerCase()) || v.fecha.includes(search)
  );

  return (
    <View style={{ flex: 1, padding: 16, gap: 12 }}>
      <Text style={{ fontSize: 20, fontWeight: "bold" }}>{es["Visitas de falantes"]}</Text>

      <Button
        title={showForm ? es["Cancelar"] : editingId ? es["Actualizar visita"] : `+ ${es["Nueva visita"]}`}
        onPress={() => {
          if (showForm) {
            resetForm();
          } else {
            setShowForm(true);
          }
        }}
      />

      {showForm && (
        <View style={{ gap: 8, padding: 12, backgroundColor: "#f5f5f5", borderRadius: 8 }}>
          <Text style={{ fontSize: 13, color: "#555" }}>{es["Falante"]}</Text>
          <FlatList data={speakers.data ?? []} keyExtractor={(item) => item.id} horizontal showsHorizontalScrollIndicator={false}
            renderItem={({ item }) => (
              <Button title={item.nombre} onPress={() => setSpeakerId(item.id)} color={speakerId === item.id ? "#1a5276" : "#ccc"} />
            )} />
          <TextInput placeholder={es["Fecha (YYYY-MM-DD)"]} value={fecha} onChangeText={setFecha} style={{ borderWidth: 1, borderColor: "#ccc", borderRadius: 6, padding: 10 }} />
          <TextInput placeholder={es["Discurso (nº opcional)"]} value={talkNumber} onChangeText={setTalkNumber} keyboardType="numeric" style={{ borderWidth: 1, borderColor: "#ccc", borderRadius: 6, padding: 10 }} />
          <TextInput placeholder={es["Notas (opcional)"]} value={notas} onChangeText={setNotas} style={{ borderWidth: 1, borderColor: "#ccc", borderRadius: 6, padding: 10 }} />
          {editingId ? (
            <>
              <Text style={{ fontSize: 13, color: "#555" }}>{es["Estado"]}</Text>
              <View style={{ flexDirection: "row", gap: 8 }}>
                {(["pendiente", "confirmada", "realizada"] as const).map((e) => (
                  <Button key={e} title={ESTADO_LABELS[e]} onPress={() => setEstado(e)} color={estado === e ? "#1a5276" : "#ccc"} />
                ))}
              </View>
            </>
          ) : null}
          <Button title={create.isPending || update.isPending ? es["Creando..."] : editingId ? es["Guardar cambios"] : es["Crear visita"]} onPress={handleCreate} disabled={create.isPending || update.isPending} />
        </View>
      )}

      <SearchBar value={search} onChangeText={setSearch} placeholder={es["Buscar por falante o fecha..."]} />

      {visits.isLoading ? <SkeletonRow lines={4} /> : null}

      {visits.isError ? (
        <Text style={{ color: "#e74c3c", textAlign: "center" }}>
          {isNetworkError(visits.error) ? es["Sin conexión"] : es["Error al cargar"]}
        </Text>
      ) : null}

      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        onRefresh={() => visits.refetch()}
        refreshing={visits.isFetching && !visits.isLoading}
        renderItem={({ item }) => (
          <View style={{ padding: 12, borderBottomWidth: 1, borderColor: "#eee", flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
            <View style={{ flex: 1 }}>
              <Text style={{ fontWeight: "bold" }}>{getSpeakerName(item.speakerId)}</Text>
              <Text style={{ fontSize: 12, color: "#666" }}>
                {fmtDate(item.fecha)} · {ESTADO_LABELS[item.estado] ?? item.estado}
                {item.talkNumber ? ` · Discurso ${item.talkNumber}` : ""}
                {item.notas ? ` · ${item.notas}` : ""}
              </Text>
            </View>
            <View style={{ flexDirection: "row", gap: 8 }}>
              <Button title={es["Editar"]} onPress={() => handleEdit(item)} />
              <Button title="X" onPress={() => {
                Alert.alert(es["Eliminar"], es["¿Eliminar esta visita?"], [
                  { text: es["Cancelar"] },
                  { text: es["Eliminar"], onPress: () => del.mutate(item.id) },
                ]);
              }} />
            </View>
          </View>
        )}
      />
    </View>
  );
}
