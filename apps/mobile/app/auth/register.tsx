import { useState, useEffect } from "react";
import { Button, Text, TextInput, View, Alert, Pressable, ScrollView, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";
import { useAuth } from "../../lib/auth";
import { listCongregations, createCongregation, type CongregationInfo } from "../../lib/api";

export default function RegisterScreen() {
  const [nombre, setNombre] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [congregationId, setCongregationId] = useState("");
  const [loading, setLoading] = useState(false);
  const [congregations, setCongregations] = useState<CongregationInfo[]>([]);
  const [loadingCongs, setLoadingCongs] = useState(true);
  const [showCreateCong, setShowCreateCong] = useState(false);
  const [newCongName, setNewCongName] = useState("");
  const [newCongNumber, setNewCongNumber] = useState("");
  const [creatingCong, setCreatingCong] = useState(false);
  const { register } = useAuth();
  const router = useRouter();

  useEffect(() => {
    loadCongregations();
  }, []);

  async function loadCongregations() {
    try {
      const list = await listCongregations();
      setCongregations(list);
    } catch {
      // ignore
    } finally {
      setLoadingCongs(false);
    }
  }

  async function handleCreateCongregation() {
    if (!newCongName.trim()) {
      Alert.alert("Error", "Nombre de congregación requerido");
      return;
    }
    setCreatingCong(true);
    try {
      const cong = await createCongregation({ nombre: newCongName.trim(), numero: newCongNumber.trim() || undefined });
      setCongregations((prev) => [...prev, cong]);
      setCongregationId(cong.id);
      setShowCreateCong(false);
      setNewCongName("");
      setNewCongNumber("");
    } catch (e) {
      Alert.alert("Error", (e as Error).message);
    } finally {
      setCreatingCong(false);
    }
  }

  async function handleRegister() {
    if (!nombre || !email || !password || !congregationId) {
      Alert.alert("Error", "Todos los campos son requeridos");
      return;
    }
    setLoading(true);
    try {
      await register({ email, password, nombre, congregation_id: congregationId });
      Alert.alert("Éxito", "Cuenta creada. Ahora inicie sesión.", [
        { text: "OK", onPress: () => router.replace("/auth/login") },
      ]);
    } catch (e) {
      Alert.alert("Error", (e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <ScrollView contentContainerStyle={{ flex: 1, justifyContent: "center", padding: 24, gap: 16 }}>
      <Text style={{ fontSize: 24, fontWeight: "bold", textAlign: "center" }}>
        Meeting Base
      </Text>
      <Text style={{ textAlign: "center", color: "#666" }}>
        Crear una cuenta nueva
      </Text>

      <TextInput
        placeholder="Nombre"
        value={nombre}
        onChangeText={setNombre}
        autoCapitalize="words"
        style={{ borderWidth: 1, borderColor: "#ccc", borderRadius: 8, padding: 12, fontSize: 16 }}
      />

      <TextInput
        placeholder="Email"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
        style={{ borderWidth: 1, borderColor: "#ccc", borderRadius: 8, padding: 12, fontSize: 16 }}
      />

      <TextInput
        placeholder="Contraseña"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        style={{ borderWidth: 1, borderColor: "#ccc", borderRadius: 8, padding: 12, fontSize: 16 }}
      />

      <View>
        <Text style={{ fontSize: 14, fontWeight: "600", marginBottom: 6 }}>Congregación</Text>
        {loadingCongs ? (
          <ActivityIndicator style={{ marginVertical: 8 }} />
        ) : showCreateCong ? (
          <View style={{ gap: 8 }}>
            <TextInput
              placeholder="Nombre de la congregación"
              value={newCongName}
              onChangeText={setNewCongName}
              style={{ borderWidth: 1, borderColor: "#ccc", borderRadius: 8, padding: 12, fontSize: 16 }}
            />
            <TextInput
              placeholder="Número (opcional)"
              value={newCongNumber}
              onChangeText={setNewCongNumber}
              keyboardType="numeric"
              style={{ borderWidth: 1, borderColor: "#ccc", borderRadius: 8, padding: 12, fontSize: 16 }}
            />
            <View style={{ flexDirection: "row", gap: 8 }}>
              <Button title={creatingCong ? "Creando..." : "Crear"} onPress={handleCreateCongregation} disabled={creatingCong} />
              <Button title="Cancelar" onPress={() => setShowCreateCong(false)} color="#999" />
            </View>
          </View>
        ) : (
          <View style={{ gap: 8 }}>
            {congregations.length > 0 ? (
              congregations.map((c) => (
                <Pressable
                  key={c.id}
                  onPress={() => setCongregationId(c.id)}
                  style={{
                    borderWidth: 1,
                    borderColor: congregationId === c.id ? "#007AFF" : "#ccc",
                    borderRadius: 8,
                    padding: 12,
                    backgroundColor: congregationId === c.id ? "#e8f0fe" : "#fff",
                  }}
                >
                  <Text style={{ fontWeight: "500" }}>{c.nombre}</Text>
                  {c.numero ? <Text style={{ color: "#666", fontSize: 13 }}>N.° {c.numero}</Text> : null}
                  {c.circuito ? <Text style={{ color: "#666", fontSize: 13 }}>Circuito: {c.circuito}</Text> : null}
                </Pressable>
              ))
            ) : (
              <Text style={{ color: "#999", fontSize: 13 }}>No hay congregaciones disponibles</Text>
            )}
            <Button title="Crear nueva congregación" onPress={() => setShowCreateCong(true)} color="#007AFF" />
          </View>
        )}
      </View>

      <Button
        title={loading ? "Creando cuenta..." : "Registrarse"}
        onPress={handleRegister}
        disabled={loading}
      />

      <Pressable onPress={() => router.replace("/auth/login")} style={{ alignItems: "center" }}>
        <Text style={{ color: "#007AFF" }}>¿Ya tiene cuenta? Inicie sesión</Text>
      </Pressable>
    </ScrollView>
  );
}
