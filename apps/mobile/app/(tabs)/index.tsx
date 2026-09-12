import { Text, View, StyleSheet, Pressable, Alert } from "react-native";
import { usePrograma } from "../../hooks/usePrograma";
import { useAuth } from "../../lib/auth";
import { getCongregationId } from "../../lib/auth";
import es from "../../i18n/es.json";

function formatDate(d: string): string {
  try {
    return new Date(d + "T12:00:00").toLocaleDateString("es", {
      weekday: "long",
      day: "numeric",
      month: "long",
    });
  } catch {
    return d;
  }
}

export default function Inicio() {
  const { user, logout } = useAuth();
  const congId = user ? getCongregationId(user) : null;
  const { meetings, offline, lastSync, isPending } = usePrograma(congId);

  const next = meetings.find(
    (m) => new Date(m.fecha + "T12:00:00") >= new Date()
  );

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
        <Text style={s.value}>
          {offline ? es["Sin conexión"] : "Conectado"}
        </Text>
        {lastSync ? (
          <Text style={s.sub}>Última sincronización: {lastSync}</Text>
        ) : null}
      </View>

      <View style={s.card}>
        <Text style={s.label}>Próxima reunión</Text>
        {isPending ? (
          <Text style={s.sub}>Cargando...</Text>
        ) : next ? (
          <>
            <Text style={s.value}>{formatDate(next.fecha)}</Text>
            <Text style={s.sub}>Sala A · {next.tipo}</Text>
            {next.semana_label ? (
              <Text style={s.sub}>{next.semana_label}</Text>
            ) : null}
          </>
        ) : (
          <Text style={s.sub}>No hay reuniones programadas</Text>
        )}
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
  label: { fontSize: 13, fontWeight: "600", color: "#555" },
  value: { fontSize: 16, fontWeight: "500" },
  sub: { fontSize: 13, color: "#777" },
});
