import { useState } from "react";
import { Button, FlatList, Text, TextInput, View, Alert } from "react-native";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { API_URL, authHeaders, getCongregationId, isNetworkError } from "../../lib/api";
import { SearchBar } from "../../components/SearchBar";
import { SkeletonRow } from "../../components/Skeleton";
import es from "../../i18n/es.json";

interface Speaker { id: string; nombre: string; }
interface Visit { id: string; speakerId: string; fecha: string; talkNumber?: number; notas?: string; estado: string; }

export default function VisitsScreen() {
  const congId = getCongregationId();
  const queryClient = useQueryClient();
  const [speakerId, setSpeakerId] = useState("");
  const [fecha, setFecha] = useState("");
  const [notas, setNotas] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [search, setSearch] = useState("");

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
    mutationFn: async (data: { speaker_id: string; fecha: string; notas?: string }) => {
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
      setSpeakerId(""); setFecha(""); setNotas(""); setShowForm(false);
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

  function handleCreate() {
    if (!speakerId || !fecha.trim()) { Alert.alert(es["Error"], es["Falante y fecha requeridos"]); return; }
    create.mutate({ speaker_id: speakerId, fecha: fecha.trim(), notas: notas || undefined });
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

      <Button title={showForm ? es["Cancelar"] : `+ ${es["Nueva visita"]}`} onPress={() => setShowForm(!showForm)} />

      {showForm && (
        <View style={{ gap: 8, padding: 12, backgroundColor: "#f5f5f5", borderRadius: 8 }}>
          <FlatList data={speakers.data ?? []} keyExtractor={(item) => item.id} horizontal showsHorizontalScrollIndicator={false}
            renderItem={({ item }) => (
              <Button title={item.nombre} onPress={() => setSpeakerId(item.id)} color={speakerId === item.id ? "#1a5276" : "#ccc"} />
            )} />
          <TextInput placeholder={es["Fecha (YYYY-MM-DD)"]} value={fecha} onChangeText={setFecha} style={{ borderWidth: 1, borderColor: "#ccc", borderRadius: 6, padding: 10 }} />
          <TextInput placeholder={es["Notas (opcional)"]} value={notas} onChangeText={setNotas} style={{ borderWidth: 1, borderColor: "#ccc", borderRadius: 6, padding: 10 }} />
          <Button title={create.isPending ? es["Creando..."] : es["Crear visita"]} onPress={handleCreate} disabled={create.isPending} />
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
        renderItem={({ item }) => (
          <View style={{ padding: 12, borderBottomWidth: 1, borderColor: "#eee", flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
            <View style={{ flex: 1 }}>
              <Text style={{ fontWeight: "bold" }}>{getSpeakerName(item.speakerId)}</Text>
              <Text style={{ fontSize: 12, color: "#666" }}>
                {item.fecha} · {item.estado}{item.notas ? ` · ${item.notas}` : ""}
              </Text>
            </View>
            <Button title="X" onPress={() => {
              Alert.alert(es["Eliminar"], es["¿Eliminar esta visita?"], [
                { text: es["Cancelar"] },
                { text: es["Eliminar"], onPress: () => del.mutate(item.id) },
              ]);
            }} />
          </View>
        )}
      />
    </View>
  );
}
