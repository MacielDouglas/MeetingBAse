import { useState } from "react";
import { Alert, Button, FlatList, Text, TextInput, View } from "react-native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createUnavailability,
  deleteUnavailability,
  getCongregationId,
  getUnavailability,
  isNetworkError,
} from "../../lib/api";
import { fmtDate } from "../../lib/formatDate";
import { usePublishers } from "../../hooks/usePublishers";
import es from "../../i18n/es.json";

interface Unavailability {
  id: string;
  publisher_id: string;
  fecha_inicio: string;
  fecha_fin: string;
  motivo?: string | null;
}

export default function AusenciasScreen() {
  const congId = getCongregationId();
  const client = useQueryClient();
  const [publisherId, setPublisherId] = useState<string | null>(null);
  const [inicio, setInicio] = useState("");
  const [fin, setFin] = useState("");
  const [motivo, setMotivo] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);

  const { data: publishers } = usePublishers(congId);
  const list = useQuery({
    queryKey: ["unavailability", congId],
    queryFn: () => getUnavailability(congId),
  });

  const save = useMutation({
    mutationFn: () =>
      createUnavailability(congId, {
        publisher_id: publisherId as string,
        fecha_inicio: inicio.trim(),
        fecha_fin: fin.trim(),
        motivo: motivo.trim() || null,
      }),
    onSuccess: async () => {
      resetForm();
      await client.invalidateQueries({ queryKey: ["unavailability", congId] });
      await client.invalidateQueries({ queryKey: ["programa", congId] });
    },
    onError: (e) => {
      Alert.alert("Error", isNetworkError(e) ? es["Sin conexión"] : (e as Error).message);
    },
  });

  const del = useMutation({
    mutationFn: (id: string) => deleteUnavailability(congId, id),
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: ["unavailability", congId] });
      await client.invalidateQueries({ queryKey: ["programa", congId] });
    },
    onError: (e) => {
      Alert.alert("Error", isNetworkError(e) ? es["Sin conexión"] : (e as Error).message);
    },
  });

  function pubName(id: string): string {
    return (publishers ?? []).find((p) => p.id === id)?.nombre ?? id.slice(0, 8);
  }

  function resetForm() {
    setInicio("");
    setFin("");
    setMotivo("");
    setPublisherId(null);
    setEditingId(null);
  }

  function handleEdit(item: Unavailability) {
    setEditingId(item.id);
    setPublisherId(item.publisher_id);
    setInicio(item.fecha_inicio);
    setFin(item.fecha_fin);
    setMotivo(item.motivo ?? "");
  }

  const valid =
    !!publisherId &&
    /^\d{4}-\d{2}-\d{2}$/.test(inicio.trim()) &&
    /^\d{4}-\d{2}-\d{2}$/.test(fin.trim()) &&
    inicio.trim() <= fin.trim();

  return (
    <View style={{ flex: 1, padding: 16, gap: 12 }}>
      <Text style={{ fontSize: 20, fontWeight: "bold" }}>{es["Ausencias"]}</Text>

      <Text style={{ fontWeight: "bold" }}>{es["Publicador"]}</Text>
      <FlatList
        data={publishers ?? []}
        keyExtractor={(item) => item.id}
        horizontal
        showsHorizontalScrollIndicator={false}
        renderItem={({ item }) => (
          <Button
            title={item.nombre}
            onPress={() => setPublisherId(item.id)}
            color={publisherId === item.id ? "#1a5276" : "#ccc"}
          />
        )}
      />

      <TextInput
        placeholder="Inicio AAAA-MM-DD"
        value={inicio}
        onChangeText={setInicio}
        style={{ borderWidth: 1, borderColor: "#ccc", borderRadius: 6, padding: 10 }}
      />
      <TextInput
        placeholder="Fin AAAA-MM-DD"
        value={fin}
        onChangeText={setFin}
        style={{ borderWidth: 1, borderColor: "#ccc", borderRadius: 6, padding: 10 }}
      />
      <TextInput
        placeholder={es["Motivo (opcional)"]}
        value={motivo}
        onChangeText={setMotivo}
        style={{ borderWidth: 1, borderColor: "#ccc", borderRadius: 6, padding: 10 }}
      />
      <View style={{ flexDirection: "row", gap: 8 }}>
        <Button
          title={save.isPending ? es["Guardando..."] : editingId ? es["Guardar cambios"] : es["Guardar ausencia"]}
          onPress={() => save.mutate()}
          disabled={save.isPending || !valid}
        />
        {editingId ? (
          <Button title={es["Cancelar"]} onPress={resetForm} color="#888" />
        ) : null}
      </View>

      <FlatList
        data={list.data ?? []}
        keyExtractor={(item) => item.id}
        onRefresh={() => list.refetch()}
        refreshing={list.isFetching && !list.isLoading}
        renderItem={({ item }) => (
          <View style={{ padding: 12, borderBottomWidth: 1, borderColor: "#eee", flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
            <View style={{ flex: 1 }}>
              <Text style={{ fontWeight: "bold" }}>{pubName(item.publisher_id)}</Text>
              <Text style={{ fontSize: 12, color: "#666" }}>
                {fmtDate(item.fecha_inicio)} → {fmtDate(item.fecha_fin)}
                {item.motivo ? ` · ${item.motivo}` : ""}
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
