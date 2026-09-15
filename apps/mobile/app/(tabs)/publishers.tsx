import { useState } from "react";
import { FlatList, Text, View, Alert, TouchableOpacity, TextInput } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { API_URL, authHeaders, getCongregationId, isNetworkError } from "../../lib/api";
import { SearchBar } from "../../components/SearchBar";
import { SkeletonRow } from "../../components/Skeleton";
import { PublisherEdit } from "../../components/PublisherEdit";
import { usePublishers } from "../../hooks/usePublishers";
import es from "../../i18n/es.json";

interface Publisher {
  id: string;
  nombre: string;
  apellido?: string;
  sexo: string;
  activo: boolean;
  celular?: string;
  telefono?: string;
  email?: string;
  familiaId?: string | null;
  siervo?: boolean;
  anciano?: boolean;
  [key: string]: unknown;
}

export default function PublishersScreen() {
  const congId = getCongregationId();
  const queryClient = useQueryClient();
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [editVisible, setEditVisible] = useState(false);
  const [selectedPub, setSelectedPub] = useState<Publisher | null>(null);

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

  const filtered = (pubs.data ?? []).filter(
    (p) => {
      const fullName = `${p.nombre} ${p.apellido ?? ""}`.toLowerCase();
      return !search || fullName.includes(search.toLowerCase());
    }
  );

  function handleEdit(pub: Publisher) {
    setSelectedPub(pub);
    setEditVisible(true);
  }

  function handleNew() {
    setSelectedPub(null);
    setEditVisible(true);
  }

  return (
    <View style={{ flex: 1, backgroundColor: "#1c1c1e" }}>
      {/* Header */}
      <View style={{ backgroundColor: "#1a5276", paddingTop: 56, paddingBottom: 12, paddingHorizontal: 16, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <TouchableOpacity onPress={() => router.back()} style={{ padding: 8 }}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={{ color: "#fff", fontSize: 18, fontWeight: "600" }}>{es["Publicadores"]}</Text>
        <TouchableOpacity onPress={handleNew} style={{ padding: 8 }}>
          <Ionicons name="person-add" size={24} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* Search */}
      <View style={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: 4 }}>
        <View style={{ flexDirection: "row", alignItems: "center", backgroundColor: "#2c2c2e", borderRadius: 10, paddingHorizontal: 10 }}>
          <Ionicons name="search" size={18} color="#8e8e93" />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder={es["Buscar publicador..."]}
            placeholderTextColor="#666"
            style={{ flex: 1, padding: 10, color: "#fff", fontSize: 15 }}
          />
          {search ? (
            <TouchableOpacity onPress={() => setSearch("")}>
              <Ionicons name="close-circle" size={18} color="#8e8e93" />
            </TouchableOpacity>
          ) : null}
        </View>
      </View>

      {pubs.isLoading ? <SkeletonRow lines={6} /> : null}

      {pubs.isError ? (
        <Text style={{ color: "#e74c3c", textAlign: "center", marginTop: 20 }}>
          {isNetworkError(pubs.error) ? es["Sin conexión"] : es["Error al cargar"]}
        </Text>
      ) : null}

      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        onRefresh={() => pubs.refetch()}
        refreshing={pubs.isFetching && !pubs.isLoading}
        contentContainerStyle={{ paddingVertical: 4 }}
        renderItem={({ item }) => {
          const isMale = item.sexo === "M";
          return (
            <TouchableOpacity
              onPress={() => handleEdit(item)}
              onLongPress={() => {
                Alert.alert(item.nombre, es["Eliminar"], [
                  { text: es["Cancelar"] },
                  { text: es["Eliminar"], style: "destructive", onPress: () => del.mutate(item.id) },
                ]);
              }}
              style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 0.5, borderBottomColor: "#3a3a3c" }}
            >
              <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: isMale ? "#1a5276" : "#8e2446", alignItems: "center", justifyContent: "center", marginRight: 12 }}>
                <Ionicons name="person" size={22} color="#fff" />
              </View>
              <Text style={{ color: "#fff", fontSize: 16, flex: 1 }}>{`${item.nombre} ${item.apellido ?? ""}`}</Text>
              {item.anciano ? <Ionicons name="star" size={16} color="#f0c040" style={{ marginRight: 6 }} /> : null}
              {item.siervo ? <Ionicons name="shield-checkmark" size={16} color="#4a90d9" /> : null}
            </TouchableOpacity>
          );
        }}
      />

      <PublisherEdit
        visible={editVisible}
        onClose={() => { setEditVisible(false); setSelectedPub(null); }}
        publisher={selectedPub}
      />
    </View>
  );
}
