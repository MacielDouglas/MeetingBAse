import { useState } from "react";
import { Button, FlatList, Text, TextInput, View, Alert } from "react-native";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { API_URL, authHeaders, getCongregationId, isNetworkError } from "../../lib/api";
import { SearchBar } from "../../components/SearchBar";
import { SkeletonRow } from "../../components/Skeleton";
import es from "../../i18n/es.json";

interface Publisher {
  id: string;
  nombre: string;
  sexo: string;
  cargo: string;
  telefono?: string;
  email?: string;
  activo: boolean;
  familiaId?: string | null;
}

const CARGO_LABELS: Record<string, string> = {
  anciano: es["Anciano"],
  siervo_ministerial: es["Siervo ministerial"],
  publicador: es["Publicador"],
};

export default function PublishersScreen() {
  const congId = getCongregationId();
  const queryClient = useQueryClient();
  const [nombre, setNombre] = useState("");
  const [sexo, setSexo] = useState<"M" | "F">("M");
  const [cargo, setCargo] = useState<string>("publicador");
  const [telefono, setTelefono] = useState("");
  const [email, setEmail] = useState("");
  const [familiaId, setFamiliaId] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [search, setSearch] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);

  const pubs = useQuery({
    queryKey: ["publishers", congId],
    queryFn: async () => {
      const res = await fetch(`${API_URL}/c/${congId}/publishers`, {
        headers: authHeaders(),
      });
      const body = await res.json();
      return (body.publishers ?? []) as Publisher[];
    },
  });

  const create = useMutation({
    mutationFn: async (data: { nombre: string; sexo: string; cargo: string; telefono?: string; email?: string; familiaId?: string | null }) => {
      const res = await fetch(`${API_URL}/c/${congId}/publishers`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify(data),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? es["Error al crear"]);
      return body.publisher;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["publishers", congId] });
      resetForm();
    },
    onError: (e) => {
      const msg = isNetworkError(e) ? es["Sin conexión. Intente más tarde."] : (e as Error).message;
      Alert.alert(es["Error"], msg);
    },
  });

  const update = useMutation({
    mutationFn: async (data: { id: string; nombre: string; sexo: string; cargo: string; telefono?: string; email?: string; familiaId?: string | null }) => {
      const res = await fetch(`${API_URL}/c/${congId}/publishers/${data.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify(data),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? es["Error al crear"]);
      return body.publisher;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["publishers", congId] });
      resetForm();
    },
    onError: (e) => {
      const msg = isNetworkError(e) ? es["Sin conexión. Intente más tarde."] : (e as Error).message;
      Alert.alert(es["Error"], msg);
    },
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`${API_URL}/c/${congId}/publishers/${id}`, {
        method: "DELETE",
        headers: authHeaders(),
      });
      if (!res.ok) throw new Error(es["Error al eliminar"]);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["publishers", congId] });
    },
    onError: (e) => {
      const msg = isNetworkError(e) ? es["Sin conexión. Intente más tarde."] : (e as Error).message;
      Alert.alert(es["Error"], msg);
    },
  });

  function resetForm() {
    setNombre("");
    setSexo("M");
    setCargo("publicador");
    setTelefono("");
    setEmail("");
    setFamiliaId("");
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
      sexo,
      cargo,
      telefono: telefono || undefined,
      email: email || undefined,
      familiaId: familiaId || null,
    };
    if (editingId) {
      update.mutate({ id: editingId, ...payload });
    } else {
      create.mutate(payload);
    }
  }

  function handleEdit(pub: Publisher) {
    setEditingId(pub.id);
    setNombre(pub.nombre);
    setSexo(pub.sexo as "M" | "F");
    setCargo(pub.cargo);
    setTelefono(pub.telefono ?? "");
    setEmail(pub.email ?? "");
    setFamiliaId(pub.familiaId ?? "");
    setShowForm(true);
  }

  const filtered = (pubs.data ?? []).filter(
    (p) => !search || p.nombre.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <View style={{ flex: 1, padding: 16, gap: 12 }}>
      <Text style={{ fontSize: 20, fontWeight: "bold" }}>{es["Publicadores"]}</Text>

      <Button
        title={showForm ? es["Cancelar"] : editingId ? es["Editar"] : `+ ${es["Nuevo publicador"]}`}
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
          <TextInput
            placeholder={es["Nombre"]}
            value={nombre}
            onChangeText={setNombre}
            style={{ borderWidth: 1, borderColor: "#ccc", borderRadius: 6, padding: 10 }}
          />
          <Text style={{ fontSize: 13, color: "#555" }}>{es["Sexo"]}</Text>
          <View style={{ flexDirection: "row", gap: 8 }}>
            <Button title="M" onPress={() => setSexo("M")} color={sexo === "M" ? "#1a5276" : "#ccc"} />
            <Button title="F" onPress={() => setSexo("F")} color={sexo === "F" ? "#1a5276" : "#ccc"} />
          </View>
          <Text style={{ fontSize: 13, color: "#555" }}>{es["Cargo"]}</Text>
          <View style={{ flexDirection: "row", gap: 8 }}>
            {(["publicador", "siervo_ministerial", "anciano"] as const).map((c) => (
              <Button key={c} title={CARGO_LABELS[c]} onPress={() => setCargo(c)} color={cargo === c ? "#7d3c98" : "#ccc"} />
            ))}
          </View>
          <TextInput
            placeholder={es["Teléfono (opcional)"]}
            value={telefono}
            onChangeText={setTelefono}
            keyboardType="phone-pad"
            style={{ borderWidth: 1, borderColor: "#ccc", borderRadius: 6, padding: 10 }}
          />
          <TextInput
            placeholder={es["Email (opcional)"]}
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            style={{ borderWidth: 1, borderColor: "#ccc", borderRadius: 6, padding: 10 }}
          />
          <TextInput
            placeholder={es["Familia (opcional)"]}
            value={familiaId}
            onChangeText={setFamiliaId}
            style={{ borderWidth: 1, borderColor: "#ccc", borderRadius: 6, padding: 10 }}
          />
          <Button
            title={create.isPending || update.isPending ? es["Creando..."] : editingId ? es["Guardar cambios"] : es["Crear publicador"]}
            onPress={handleCreate}
            disabled={create.isPending || update.isPending}
          />
        </View>
      )}

      <SearchBar value={search} onChangeText={setSearch} placeholder={es["Buscar publicador..."]} />

      {pubs.isLoading ? <SkeletonRow lines={4} /> : null}

      {pubs.isError ? (
        <Text style={{ color: "#e74c3c", textAlign: "center" }}>
          {isNetworkError(pubs.error) ? es["Sin conexión"] : es["Error al cargar"]}
        </Text>
      ) : null}

      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        onRefresh={() => pubs.refetch()}
        refreshing={pubs.isFetching && !pubs.isLoading}
        renderItem={({ item }) => (
          <View style={{ padding: 12, borderBottomWidth: 1, borderColor: "#eee", flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
            <View style={{ flex: 1 }}>
              <Text style={{ fontWeight: "bold" }}>{item.nombre}</Text>
              <Text style={{ fontSize: 12, color: "#666" }}>
                {CARGO_LABELS[item.cargo] ?? item.cargo} · {item.sexo}
                {item.telefono ? ` · ${item.telefono}` : ""}
                {item.email ? ` · ${item.email}` : ""}
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
