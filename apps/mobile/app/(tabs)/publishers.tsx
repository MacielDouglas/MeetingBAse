import { useState } from "react";
import { Button, FlatList, Text, TextInput, View, Alert } from "react-native";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth, authHeaders, getCongregationId } from "../../lib/auth";
import { API_URL } from "../../lib/api";
import es from "../../i18n/es.json";

interface Publisher {
  id: string;
  nombre: string;
  sexo: string;
  cargo: string;
  telefono?: string;
  activo: boolean;
}

const CARGO_LABELS: Record<string, string> = {
  anciano: "Anciano",
  siervo_ministerial: "Siervo ministerial",
  publicador: "Publicador",
};

export default function PublishersScreen() {
  const { user, token } = useAuth();
  const congId = getCongregationId(user);
  const queryClient = useQueryClient();
  const [nombre, setNombre] = useState("");
  const [sexo, setSexo] = useState<"M" | "F">("M");
  const [cargo, setCargo] = useState<string>("publicador");
  const [telefono, setTelefono] = useState("");
  const [showForm, setShowForm] = useState(false);

  const pubs = useQuery({
    queryKey: ["publishers", congId],
    queryFn: async () => {
      const res = await fetch(`${API_URL}/c/${congId}/publishers`, {
        headers: authHeaders(token),
      });
      const body = await res.json();
      return (body.publishers ?? []) as Publisher[];
    },
  });

  const create = useMutation({
    mutationFn: async (data: { nombre: string; sexo: string; cargo: string; telefono?: string }) => {
      const res = await fetch(`${API_URL}/c/${congId}/publishers`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders(token) },
        body: JSON.stringify(data),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Error al crear");
      return body.publisher;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["publishers", congId] });
      setNombre("");
      setTelefono("");
      setShowForm(false);
    },
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`${API_URL}/c/${congId}/publishers/${id}`, {
        method: "DELETE",
        headers: authHeaders(token),
      });
      if (!res.ok) throw new Error("Error al eliminar");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["publishers", congId] });
    },
  });

  function handleCreate() {
    if (!nombre.trim()) {
      Alert.alert("Error", "Nombre requerido");
      return;
    }
    create.mutate({ nombre: nombre.trim(), sexo, cargo, telefono: telefono || undefined });
  }

  return (
    <View style={{ flex: 1, padding: 16, gap: 12 }}>
      <Text style={{ fontSize: 20, fontWeight: "bold" }}>{es["Publicadores"]}</Text>

      <Button
        title={showForm ? "Cancelar" : "+ Nuevo publicador"}
        onPress={() => setShowForm(!showForm)}
      />

      {showForm && (
        <View style={{ gap: 8, padding: 12, backgroundColor: "#f5f5f5", borderRadius: 8 }}>
          <TextInput
            placeholder="Nombre"
            value={nombre}
            onChangeText={setNombre}
            style={{ borderWidth: 1, borderColor: "#ccc", borderRadius: 6, padding: 10 }}
          />
          <View style={{ flexDirection: "row", gap: 8 }}>
            <Button
              title="M"
              onPress={() => setSexo("M")}
              color={sexo === "M" ? "#1a5276" : "#ccc"}
            />
            <Button
              title="F"
              onPress={() => setSexo("F")}
              color={sexo === "F" ? "#1a5276" : "#ccc"}
            />
          </View>
          <View style={{ flexDirection: "row", gap: 8 }}>
            {(["publicador", "siervo_ministerial", "anciano"] as const).map((c) => (
              <Button
                key={c}
                title={CARGO_LABELS[c]}
                onPress={() => setCargo(c)}
                color={cargo === c ? "#7d3c98" : "#ccc"}
              />
            ))}
          </View>
          <TextInput
            placeholder="Teléfono (opcional)"
            value={telefono}
            onChangeText={setTelefono}
            keyboardType="phone-pad"
            style={{ borderWidth: 1, borderColor: "#ccc", borderRadius: 6, padding: 10 }}
          />
          <Button
            title={create.isPending ? "Creando..." : "Crear publicador"}
            onPress={handleCreate}
            disabled={create.isPending}
          />
        </View>
      )}

      {pubs.isLoading ? <Text>Cargando...</Text> : null}

      <FlatList
        data={pubs.data ?? []}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View
            style={{
              padding: 12,
              borderBottomWidth: 1,
              borderColor: "#eee",
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <View style={{ flex: 1 }}>
              <Text style={{ fontWeight: "bold" }}>{item.nombre}</Text>
              <Text style={{ fontSize: 12, color: "#666" }}>
                {CARGO_LABELS[item.cargo] ?? item.cargo} · {item.sexo}
                {item.telefono ? ` · ${item.telefono}` : ""}
              </Text>
            </View>
            <Button
              title="X"
              onPress={() => {
                Alert.alert("Eliminar", `¿Eliminar ${item.nombre}?`, [
                  { text: "Cancelar" },
                  { text: "Eliminar", onPress: () => del.mutate(item.id) },
                ]);
              }}
            />
          </View>
        )}
      />
    </View>
  );
}
