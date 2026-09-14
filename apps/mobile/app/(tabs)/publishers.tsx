import { useState } from "react";
import { Button, FlatList, Text, TextInput, View, Alert, ScrollView } from "react-native";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { API_URL, authHeaders, getCongregationId, isNetworkError } from "../../lib/api";
import { SearchBar } from "../../components/SearchBar";
import { SkeletonRow } from "../../components/Skeleton";
import { PrivilegesForm, PublisherPrivileges, DEFAULT_PRIVILEGES } from "../../components/PrivilegesForm";
import es from "../../i18n/es.json";

interface Publisher {
  id: string;
  nombre: string;
  sexo: string;
  cargo: string;
  telefono?: string;
  activo: boolean;
  privileges: PublisherPrivileges;
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
  const [privileges, setPrivileges] = useState<PublisherPrivileges>(DEFAULT_PRIVILEGES);
  const [showForm, setShowForm] = useState(false);
  const [wizardStep, setWizardStep] = useState<1 | 2>(1);
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
    mutationFn: async (data: { nombre: string; sexo: string; cargo: string; telefono?: string; privileges?: Partial<PublisherPrivileges> }) => {
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
    mutationFn: async (data: { id: string; nombre: string; sexo: string; cargo: string; telefono?: string; privileges?: Partial<PublisherPrivileges> }) => {
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
    setPrivileges(DEFAULT_PRIVILEGES);
    setShowForm(false);
    setWizardStep(1);
    setEditingId(null);
  }

  function handleCreate() {
    if (!nombre.trim()) {
      Alert.alert(es["Error"], es["Nombre requerido"]);
      return;
    }
    if (editingId) {
      update.mutate({
        id: editingId,
        nombre: nombre.trim(),
        sexo,
        cargo,
        telefono: telefono || undefined,
        privileges,
      });
    } else {
      create.mutate({
        nombre: nombre.trim(),
        sexo,
        cargo,
        telefono: telefono || undefined,
        privileges,
      });
    }
  }

  function handleEdit(pub: Publisher) {
    setEditingId(pub.id);
    setNombre(pub.nombre);
    setSexo(pub.sexo as "M" | "F");
    setCargo(pub.cargo);
    setTelefono(pub.telefono ?? "");
    setPrivileges(pub.privileges);
    setShowForm(true);
    setWizardStep(1);
  }

  function handleSkipPrivileges() {
    if (!nombre.trim()) {
      Alert.alert(es["Error"], es["Nombre requerido"]);
      return;
    }
    handleCreate();
  }

  const filtered = (pubs.data ?? []).filter(
    (p) => !search || p.nombre.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <View style={{ flex: 1, padding: 16, gap: 12 }}>
      <Text style={{ fontSize: 20, fontWeight: "bold" }}>{es["Publicadores"]}</Text>

      <Button
        title={showForm ? es["Cancelar"] : `+ ${es["Nuevo publicador"]}`}
        onPress={() => {
          if (showForm) {
            resetForm();
          } else {
            setShowForm(true);
            setWizardStep(1);
          }
        }}
      />

      {showForm && (
        <View style={{ gap: 8, padding: 12, backgroundColor: "#f5f5f5", borderRadius: 8 }}>
          <Text style={{ fontSize: 14, color: "#666", textAlign: "center" }}>
            {editingId ? `${es["Paso"]} ${wizardStep} ${es["de"]}` : `${es["Paso 1 de 2"]}`}
          </Text>

          {wizardStep === 1 && (
            <View style={{ gap: 8 }}>
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
              <View style={{ flexDirection: "row", gap: 8 }}>
                {editingId ? (
                  <>
                    <Button
                      title={es["Próximo"]}
                      onPress={() => {
                        if (!nombre.trim()) {
                          Alert.alert(es["Error"], es["Nombre requerido"]);
                          return;
                        }
                        setWizardStep(2);
                      }}
                    />
                    <Button
                      title={update.isPending ? es["Creando..."] : es["Guardar"]}
                      onPress={handleCreate}
                      disabled={update.isPending}
                    />
                  </>
                ) : (
                  <>
                    <Button
                      title={es["Próximo"]}
                      onPress={() => {
                        if (!nombre.trim()) {
                          Alert.alert(es["Error"], es["Nombre requerido"]);
                          return;
                        }
                        setWizardStep(2);
                      }}
                    />
                    <Button
                      title={es["Omitir"]}
                      onPress={handleSkipPrivileges}
                      color="#999"
                    />
                  </>
                )}
              </View>
            </View>
          )}

          {wizardStep === 2 && (
            <ScrollView style={{ maxHeight: 400 }}>
              <PrivilegesForm
                sexo={sexo}
                cargo={cargo}
                privileges={privileges}
                onPrivilegesChange={setPrivileges}
              />
              <View style={{ flexDirection: "row", gap: 8, marginTop: 12 }}>
                <Button
                  title={es["Anterior"]}
                  onPress={() => setWizardStep(1)}
                  color="#999"
                />
                <Button
                  title={create.isPending || update.isPending ? es["Creando..."] : editingId ? es["Guardar"] : es["Crear publicador"]}
                  onPress={handleCreate}
                  disabled={create.isPending || update.isPending}
                />
              </View>
            </ScrollView>
          )}
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
        renderItem={({ item }) => (
          <View style={{ padding: 12, borderBottomWidth: 1, borderColor: "#eee", flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
            <View style={{ flex: 1 }}>
              <Text style={{ fontWeight: "bold" }}>{item.nombre}</Text>
              <Text style={{ fontSize: 12, color: "#666" }}>
                {CARGO_LABELS[item.cargo] ?? item.cargo} · {item.sexo}
                {item.telefono ? ` · ${item.telefono}` : ""}
              </Text>
            </View>
            <View style={{ flexDirection: "row", gap: 8 }}>
              <Button title={es["Privilegios"]} onPress={() => handleEdit(item)} />
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
