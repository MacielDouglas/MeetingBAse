import { useState } from "react";
import { Button, FlatList, Text, TextInput, View, Alert } from "react-native";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth, authHeaders, getCongregationId } from "../../lib/auth";
import { API_URL, isNetworkError } from "../../lib/api";
import { SearchBar } from "../../components/SearchBar";
import { SkeletonRow } from "../../components/Skeleton";

interface Speaker { id: string; nombre: string; }
interface Visit { id: string; speakerId: string; fecha: string; talkNumber?: number; notas?: string; estado: string; }

export default function VisitsScreen() {
  const { user, token } = useAuth();
  const congId = getCongregationId(user);
  const queryClient = useQueryClient();
  const [speakerId, setSpeakerId] = useState("");
  const [fecha, setFecha] = useState("");
  const [notas, setNotas] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [search, setSearch] = useState("");

  const speakers = useQuery({
    queryKey: ["speakers", congId],
    queryFn: async () => {
      const res = await fetch(`${API_URL}/c/${congId}/speakers`, { headers: authHeaders(token) });
      const body = await res.json();
      return (body.speakers ?? []) as Speaker[];
    },
  });

  const visits = useQuery({
    queryKey: ["visits", congId],
    queryFn: async () => {
      const res = await fetch(`${API_URL}/c/${congId}/visits`, { headers: authHeaders(token) });
      const body = await res.json();
      return (body.visits ?? []) as Visit[];
    },
  });

  const create = useMutation({
    mutationFn: async (data: { speaker_id: string; fecha: string; notas?: string }) => {
      const res = await fetch(`${API_URL}/c/${congId}/visits`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders(token) },
        body: JSON.stringify(data),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Error al crear");
      return body.visit;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["visits", congId] });
      setSpeakerId(""); setFecha(""); setNotas(""); setShowForm(false);
    },
    onError: (e) => {
      const msg = isNetworkError(e) ? "Sin conexión. Intente más tarde." : (e as Error).message;
      Alert.alert("Error", msg);
    },
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`${API_URL}/c/${congId}/visits/${id}`, { method: "DELETE", headers: authHeaders(token) });
      if (!res.ok) throw new Error("Error al eliminar");
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["visits", congId] }); },
    onError: (e) => {
      const msg = isNetworkError(e) ? "Sin conexión. Intente más tarde." : (e as Error).message;
      Alert.alert("Error", msg);
    },
  });

  function handleCreate() {
    if (!speakerId || !fecha.trim()) { Alert.alert("Error", "Falante y fecha requeridos"); return; }
    create.mutate({ speaker_id: speakerId, fecha: fecha.trim(), notas: notas || undefined });
  }

  function getSpeakerName(id: string): string {
    return speakers.data?.find((s) => s.id === id)?.nombre ?? "Desconocido";
  }

  const filtered = (visits.data ?? []).filter(
    (v) => !search || getSpeakerName(v.speakerId).toLowerCase().includes(search.toLowerCase()) || v.fecha.includes(search)
  );

  return (
    <View style={{ flex: 1, padding: 16, gap: 12 }}>
      <Text style={{ fontSize: 20, fontWeight: "bold" }}>Visitas de falantes</Text>

      <Button title={showForm ? "Cancelar" : "+ Nueva visita"} onPress={() => setShowForm(!showForm)} />

      {showForm && (
        <View style={{ gap: 8, padding: 12, backgroundColor: "#f5f5f5", borderRadius: 8 }}>
          <FlatList data={speakers.data ?? []} keyExtractor={(item) => item.id} horizontal showsHorizontalScrollIndicator={false}
            renderItem={({ item }) => (
              <Button title={item.nombre} onPress={() => setSpeakerId(item.id)} color={speakerId === item.id ? "#1a5276" : "#ccc"} />
            )} />
          <TextInput placeholder="Fecha (YYYY-MM-DD)" value={fecha} onChangeText={setFecha} style={{ borderWidth: 1, borderColor: "#ccc", borderRadius: 6, padding: 10 }} />
          <TextInput placeholder="Notas (opcional)" value={notas} onChangeText={setNotas} style={{ borderWidth: 1, borderColor: "#ccc", borderRadius: 6, padding: 10 }} />
          <Button title={create.isPending ? "Creando..." : "Crear visita"} onPress={handleCreate} disabled={create.isPending} />
        </View>
      )}

      <SearchBar value={search} onChangeText={setSearch} placeholder="Buscar por falante o fecha..." />

      {visits.isLoading ? <SkeletonRow lines={4} /> : null}

      {visits.isError ? (
        <Text style={{ color: "#e74c3c", textAlign: "center" }}>
          {isNetworkError(visits.error) ? "Sin conexión" : "Error al cargar"}
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
              Alert.alert("Eliminar", "¿Eliminar esta visita?", [
                { text: "Cancelar" },
                { text: "Eliminar", onPress: () => del.mutate(item.id) },
              ]);
            }} />
          </View>
        )}
      />
    </View>
  );
}
