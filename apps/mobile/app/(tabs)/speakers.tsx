import { useState } from "react";
import { Button, FlatList, Text, TextInput, View, Alert } from "react-native";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth, authHeaders, getCongregationId } from "../../lib/auth";
import { API_URL, isNetworkError } from "../../lib/api";
import { SearchBar } from "../../components/SearchBar";
import { SkeletonRow } from "../../components/Skeleton";

interface Speaker {
  id: string;
  nombre: string;
  telefono?: string;
  celular?: string;
  email?: string;
  talkNumbers: number[];
  activo: boolean;
}

export default function SpeakersScreen() {
  const { user, token } = useAuth();
  const congId = getCongregationId(user);
  const queryClient = useQueryClient();
  const [nombre, setNombre] = useState("");
  const [telefono, setTelefono] = useState("");
  const [celular, setCelular] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [search, setSearch] = useState("");

  const speakers = useQuery({
    queryKey: ["speakers", congId],
    queryFn: async () => {
      const res = await fetch(`${API_URL}/c/${congId}/speakers`, {
        headers: authHeaders(token),
      });
      const body = await res.json();
      return (body.speakers ?? []) as Speaker[];
    },
  });

  const create = useMutation({
    mutationFn: async (data: { nombre: string; telefono?: string; celular?: string }) => {
      const res = await fetch(`${API_URL}/c/${congId}/speakers`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders(token) },
        body: JSON.stringify(data),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Error al crear");
      return body.speaker;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["speakers", congId] });
      setNombre("");
      setTelefono("");
      setCelular("");
      setShowForm(false);
    },
    onError: (e) => {
      const msg = isNetworkError(e) ? "Sin conexión. Intente más tarde." : (e as Error).message;
      Alert.alert("Error", msg);
    },
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`${API_URL}/c/${congId}/speakers/${id}`, {
        method: "DELETE",
        headers: authHeaders(token),
      });
      if (!res.ok) throw new Error("Error al eliminar");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["speakers", congId] });
    },
    onError: (e) => {
      const msg = isNetworkError(e) ? "Sin conexión. Intente más tarde." : (e as Error).message;
      Alert.alert("Error", msg);
    },
  });

  function handleCreate() {
    if (!nombre.trim()) {
      Alert.alert("Error", "Nombre requerido");
      return;
    }
    create.mutate({ nombre: nombre.trim(), telefono: telefono || undefined, celular: celular || undefined });
  }

  const filtered = (speakers.data ?? []).filter(
    (s) => !search || s.nombre.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <View style={{ flex: 1, padding: 16, gap: 12 }}>
      <Text style={{ fontSize: 20, fontWeight: "bold" }}>Falantes públicos</Text>

      <Button title={showForm ? "Cancelar" : "+ Nuevo falante"} onPress={() => setShowForm(!showForm)} />

      {showForm && (
        <View style={{ gap: 8, padding: 12, backgroundColor: "#f5f5f5", borderRadius: 8 }}>
          <TextInput placeholder="Nombre" value={nombre} onChangeText={setNombre} style={{ borderWidth: 1, borderColor: "#ccc", borderRadius: 6, padding: 10 }} />
          <TextInput placeholder="Teléfono" value={telefono} onChangeText={setTelefono} keyboardType="phone-pad" style={{ borderWidth: 1, borderColor: "#ccc", borderRadius: 6, padding: 10 }} />
          <TextInput placeholder="Celular" value={celular} onChangeText={setCelular} keyboardType="phone-pad" style={{ borderWidth: 1, borderColor: "#ccc", borderRadius: 6, padding: 10 }} />
          <Button title={create.isPending ? "Creando..." : "Crear falante"} onPress={handleCreate} disabled={create.isPending} />
        </View>
      )}

      <SearchBar value={search} onChangeText={setSearch} placeholder="Buscar falante..." />

      {speakers.isLoading ? <SkeletonRow lines={4} /> : null}

      {speakers.isError ? (
        <Text style={{ color: "#e74c3c", textAlign: "center" }}>
          {isNetworkError(speakers.error) ? "Sin conexión" : "Error al cargar"}
        </Text>
      ) : null}

      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={{ padding: 12, borderBottomWidth: 1, borderColor: "#eee", flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
            <View style={{ flex: 1 }}>
              <Text style={{ fontWeight: "bold" }}>{item.nombre}</Text>
              <Text style={{ fontSize: 12, color: "#666" }}>
                {item.telefono ?? ""}{item.celular ? ` · ${item.celular}` : ""}
                {item.talkNumbers.length > 0 ? ` · Discursos: ${item.talkNumbers.join(", ")}` : ""}
              </Text>
            </View>
            <Button title="X" onPress={() => {
              Alert.alert("Eliminar", `¿Eliminar ${item.nombre}?`, [
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
