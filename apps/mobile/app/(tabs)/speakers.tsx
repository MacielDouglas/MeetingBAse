import { useState } from "react";
import { Button, FlatList, Text, TextInput, View, Alert, TouchableOpacity } from "react-native";
import { useRouter } from "expo-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { API_URL, authHeaders, getCongregationId, isNetworkError } from "../../lib/api";
import { SearchBar } from "../../components/SearchBar";
import { SkeletonRow } from "../../components/Skeleton";
import es from "../../i18n/es.json";

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
  const congId = getCongregationId();
  const queryClient = useQueryClient();
  const router = useRouter();
  const [nombre, setNombre] = useState("");
  const [telefono, setTelefono] = useState("");
  const [celular, setCelular] = useState("");
  const [email, setEmail] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [search, setSearch] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);

  const speakers = useQuery({
    queryKey: ["speakers", congId],
    queryFn: async () => {
      const res = await fetch(`${API_URL}/c/${congId}/speakers`, {
        headers: authHeaders(),
      });
      const body = await res.json();
      return (body.speakers ?? []) as Speaker[];
    },
  });

  const create = useMutation({
    mutationFn: async (data: { nombre: string; telefono?: string; celular?: string; email?: string }) => {
      const res = await fetch(`${API_URL}/c/${congId}/speakers`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify(data),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? es["Error al crear"]);
      return body.speaker;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["speakers", congId] });
      resetForm();
    },
    onError: (e) => {
      const msg = isNetworkError(e) ? es["Sin conexión. Intente más tarde."] : (e as Error).message;
      Alert.alert(es["Error"], msg);
    },
  });

  const update = useMutation({
    mutationFn: async (data: { id: string; nombre: string; telefono?: string; celular?: string; email?: string }) => {
      const res = await fetch(`${API_URL}/c/${congId}/speakers/${data.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify(data),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? es["Error al crear"]);
      return body.speaker;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["speakers", congId] });
      resetForm();
    },
    onError: (e) => {
      const msg = isNetworkError(e) ? es["Sin conexión. Intente más tarde."] : (e as Error).message;
      Alert.alert(es["Error"], msg);
    },
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`${API_URL}/c/${congId}/speakers/${id}`, {
        method: "DELETE",
        headers: authHeaders(),
      });
      if (!res.ok) throw new Error(es["Error al eliminar"]);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["speakers", congId] });
    },
    onError: (e) => {
      const msg = isNetworkError(e) ? es["Sin conexión. Intente más tarde."] : (e as Error).message;
      Alert.alert(es["Error"], msg);
    },
  });

  function resetForm() {
    setNombre("");
    setTelefono("");
    setCelular("");
    setEmail("");
    setShowForm(false);
    setEditingId(null);
  }

  function handleCreate() {
    if (!nombre.trim()) {
      Alert.alert(es["Error"], es["Nombre requerido"]);
      return;
    }
    const payload = {
      nombre: nombre.trim(),
      telefono: telefono || undefined,
      celular: celular || undefined,
      email: email || undefined,
    };
    if (editingId) {
      update.mutate({ id: editingId, ...payload });
    } else {
      create.mutate(payload);
    }
  }

  function handleEdit(s: Speaker) {
    setEditingId(s.id);
    setNombre(s.nombre);
    setTelefono(s.telefono ?? "");
    setCelular(s.celular ?? "");
    setEmail(s.email ?? "");
    setShowForm(true);
  }

  const filtered = (speakers.data ?? []).filter(
    (s) => !search || s.nombre.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <View style={{ flex: 1, padding: 16, gap: 12 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
        <TouchableOpacity onPress={() => router.back()} style={{ padding: 8 }}>
          <Text style={{ fontSize: 18 }}>{es["Volver"]}</Text>
        </TouchableOpacity>
        <Text style={{ fontSize: 20, fontWeight: "bold" }}>{es["Falantes públicos"]}</Text>
      </View>

      <Button
        title={showForm ? es["Cancelar"] : editingId ? es["Actualizar orador"] : `+ ${es["Nuevo falante"]}`}
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
          <TextInput placeholder={es["Nombre"]} value={nombre} onChangeText={setNombre} style={{ borderWidth: 1, borderColor: "#ccc", borderRadius: 6, padding: 10 }} />
          <TextInput placeholder={es["Teléfono"]} value={telefono} onChangeText={setTelefono} keyboardType="phone-pad" style={{ borderWidth: 1, borderColor: "#ccc", borderRadius: 6, padding: 10 }} />
          <TextInput placeholder={es["Celular"]} value={celular} onChangeText={setCelular} keyboardType="phone-pad" style={{ borderWidth: 1, borderColor: "#ccc", borderRadius: 6, padding: 10 }} />
          <TextInput placeholder={es["Email (opcional)"]} value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" style={{ borderWidth: 1, borderColor: "#ccc", borderRadius: 6, padding: 10 }} />
          <Button title={create.isPending || update.isPending ? es["Creando..."] : editingId ? es["Guardar cambios"] : es["Crear falante"]} onPress={handleCreate} disabled={create.isPending || update.isPending} />
        </View>
      )}

      <SearchBar value={search} onChangeText={setSearch} placeholder={es["Buscar falante..."]} />

      {speakers.isLoading ? <SkeletonRow lines={4} /> : null}

      {speakers.isError ? (
        <Text style={{ color: "#e74c3c", textAlign: "center" }}>
          {isNetworkError(speakers.error) ? es["Sin conexión"] : es["Error al cargar"]}
        </Text>
      ) : null}

      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        onRefresh={() => speakers.refetch()}
        refreshing={speakers.isFetching && !speakers.isLoading}
        renderItem={({ item }) => (
          <View style={{ padding: 12, borderBottomWidth: 1, borderColor: "#eee", flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
            <View style={{ flex: 1 }}>
              <Text style={{ fontWeight: "bold" }}>{item.nombre}</Text>
              <Text style={{ fontSize: 12, color: "#666" }}>
                {item.telefono ?? ""}{item.celular ? ` · ${item.celular}` : ""}
                {item.email ? ` · ${item.email}` : ""}
                {item.talkNumbers.length > 0 ? ` · ${es["Discursos"]}: ${item.talkNumbers.join(", ")}` : ""}
              </Text>
            </View>
            <View style={{ flexDirection: "row", gap: 8 }}>
              <Button title={es["Editar"]} onPress={() => handleEdit(item)} />
              <Button title="X" onPress={() => {
                Alert.alert(es["Eliminar"], `¿Eliminar ${item.nombre}?`, [
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
