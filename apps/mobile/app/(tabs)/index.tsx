import { Text, View, StyleSheet, Pressable, Alert } from "react-native";
import { usePrograma } from "../../hooks/usePrograma";
import { usePublishers } from "../../hooks/usePublishers";
import { useAuth } from "../../lib/auth";
import { getCongregationId } from "../../lib/api";
import { fmtDate, fmtLastSync } from "../../lib/formatDate";
import es from "../../i18n/es.json";

export default function Inicio() {
  const { user, logout } = useAuth();
  const congId = user ? getCongregationId() : null;
  const { meetings, offline, lastSync, isPending } = usePrograma(congId);
  const { data: publishers } = usePublishers(congId);

  const next = meetings.find(
    (m) => new Date(m.fecha + "T12:00:00") >= new Date()
  );

  const publishedCount = meetings.filter((m) => m.estado === "published").length;
  const draftCount = meetings.filter((m) => m.estado === "draft").length;
  const totalParts = meetings.reduce((acc, m) => acc + m.parts.length, 0);
  const assignedParts = meetings.reduce(
    (acc, m) => acc + m.parts.filter((p) => p.titular_id).length,
    0
  );
  const pendingParts = totalParts - assignedParts;
  const pubCount = (publishers ?? []).filter((p) => p.activo).length;

  function handleLogout() {
    Alert.alert(es["Cerrar sesión"], "¿Está seguro?", [
      { text: "Cancelar" },
      { text: "Salir", onPress: () => logout(), style: "destructive" },
    ]);
  }

  return (
    <View style={s.container}>
      <View style={s.header}>
        <Text style={s.title}>{es["Inicio"]}</Text>
        <Pressable onPress={handleLogout} style={s.logoutBtn}>
          <Text style={s.logoutText}>{es["Cerrar sesión"]}</Text>
        </Pressable>
      </View>

      {user ? (
        <View style={s.card}>
          <Text style={s.label}>Sesión</Text>
          <Text style={s.value}>{user.nombre}</Text>
          <Text style={s.sub}>{user.email}</Text>
        </View>
      ) : null}

      <View style={s.card}>
        <Text style={s.label}>{es["Estado"]}</Text>
        <Text style={s.value}>Offline — verifique la IP del servidor</Text>
        {lastSync ? (
          <Text style={s.sub}>Última sincronización: {fmtLastSync(lastSync)}</Text>
        ) : null}
      </View>

      <View style={s.card}>
        <Text style={s.label}>Próxima reunión</Text>
        {isPending ? (
          <Text style={s.sub}>Cargando...</Text>
        ) : next ? (
          <>
            <Text style={s.value}>{fmtDate(next.fecha)}</Text>
            <Text style={s.sub}>{next.tipo} · {next.semana_label ?? ""}</Text>
          </>
        ) : (
          <Text style={s.sub}>No hay reuniones programadas</Text>
        )}
      </View>

      <View style={s.row}>
        <View style={[s.card, { flex: 1 }]}>
          <Text style={s.label}>Reuniones</Text>
          <Text style={s.bigNum}>{meetings.length}</Text>
          <Text style={s.sub}>{publishedCount} publicadas · {draftCount} borradores</Text>
        </View>
        <View style={[s.card, { flex: 1 }]}>
          <Text style={s.label}>Publicadores</Text>
          <Text style={s.bigNum}>{pubCount}</Text>
          <Text style={s.sub}>activos</Text>
        </View>
      </View>

      <View style={s.card}>
        <Text style={s.label}>Designaciones</Text>
        <Text style={s.bigNum}>{assignedParts} / {totalParts}</Text>
        <Text style={s.sub}>
          {pendingParts > 0 ? `${pendingParts} partes sin asignar` : "Todas asignadas ✓"}
        </Text>
      </View>

      <View style={s.card}>
        <Text style={s.label}>Acciones rápidas</Text>
        <Text style={s.sub}>Importar archivos .jwpub en la pestaña Importar</Text>
        <Text style={s.sub}>Ver programa completo en la pestaña Programa</Text>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, padding: 16, gap: 12 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  title: { fontSize: 22, fontWeight: "bold" },
  logoutBtn: { backgroundColor: "#e74c3c", paddingHorizontal: 14, paddingVertical: 6, borderRadius: 6 },
  logoutText: { color: "#fff", fontWeight: "600" },
  card: {
    backgroundColor: "#f5f5f5",
    borderRadius: 10,
    padding: 14,
    gap: 4,
  },
  row: { flexDirection: "row", gap: 12 },
  label: { fontSize: 13, fontWeight: "600", color: "#555" },
  value: { fontSize: 16, fontWeight: "500" },
  bigNum: { fontSize: 28, fontWeight: "bold", color: "#1a5276" },
  sub: { fontSize: 13, color: "#777" },
});
