import { useState } from "react";
import { Text, View, StyleSheet, TextInput, Pressable, Alert, ScrollView } from "react-native";
import { useAuth } from "../../lib/auth";
import { updateProfile } from "../../lib/api";
import es from "../../i18n/es.json";

export default function ProfileScreen() {
  const { user } = useAuth();
  const [nombre, setNombre] = useState(user?.nombre ?? "");
  const [email, setEmail] = useState(user?.email ?? "");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSave() {
    if (!nombre.trim()) {
      Alert.alert(es["Error"], es["El nombre es requerido"]);
      return;
    }
    setLoading(true);
    try {
      const data: { nombre?: string; email?: string; password?: string } = {};
      if (nombre.trim() !== user?.nombre) data.nombre = nombre.trim();
      if (email.trim() !== user?.email) data.email = email.trim();
      if (password.trim()) data.password = password.trim();
      if (Object.keys(data).length === 0) {
        Alert.alert(es["Info"], es["No hay cambios para guardar"]);
        return;
      }
      await updateProfile(data);
      Alert.alert(es["Éxito"], es["Perfil actualizado"]);
      setPassword("");
    } catch (e) {
      Alert.alert(es["Error"], (e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <ScrollView contentContainerStyle={s.container}>
      <Text style={s.title}>{es["Nombre"]}</Text>
      <TextInput
        value={nombre}
        onChangeText={setNombre}
        style={s.input}
        autoCapitalize="words"
      />

      <Text style={s.title}>{es["Email"]}</Text>
      <TextInput
        value={email}
        onChangeText={setEmail}
        style={s.input}
        autoCapitalize="none"
        keyboardType="email-address"
      />

      <Text style={s.title}>{es["Nueva contraseña (dejar vacío para no cambiar)"]}</Text>
      <TextInput
        value={password}
        onChangeText={setPassword}
        style={s.input}
        secureTextEntry
      />

      <View style={s.info}>
        <Text style={s.label}>{es["Rol"]}: {user?.rol ?? "—"}</Text>
        <Text style={s.label}>{es["Congregación"]}: {user?.congregationId ?? "—"}</Text>
      </View>

      <Pressable onPress={handleSave} style={s.btn} disabled={loading}>
        <Text style={s.btnText}>{loading ? es["Guardando..."] : es["Guardar"]}</Text>
      </Pressable>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, padding: 16, gap: 12 },
  title: { fontSize: 14, fontWeight: "600", color: "#555" },
  input: {
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
  },
  info: { gap: 4, marginTop: 8 },
  label: { fontSize: 13, color: "#777" },
  btn: {
    backgroundColor: "#007AFF",
    padding: 14,
    borderRadius: 8,
    alignItems: "center",
    marginTop: 12,
  },
  btnText: { color: "#fff", fontWeight: "600", fontSize: 16 },
});
