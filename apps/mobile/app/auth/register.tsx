import { useState } from "react";
import { Button, Text, TextInput, View, Alert, Pressable } from "react-native";
import { useRouter } from "expo-router";
import { useAuth } from "../../lib/auth";

export default function RegisterScreen() {
  const [nombre, setNombre] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [congregationId, setCongregationId] = useState("");
  const [loading, setLoading] = useState(false);
  const { register } = useAuth();
  const router = useRouter();

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
    <View style={{ flex: 1, justifyContent: "center", padding: 24, gap: 16 }}>
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
        style={{
          borderWidth: 1,
          borderColor: "#ccc",
          borderRadius: 8,
          padding: 12,
          fontSize: 16,
        }}
      />

      <TextInput
        placeholder="Email"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
        style={{
          borderWidth: 1,
          borderColor: "#ccc",
          borderRadius: 8,
          padding: 12,
          fontSize: 16,
        }}
      />

      <TextInput
        placeholder="Contraseña"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        style={{
          borderWidth: 1,
          borderColor: "#ccc",
          borderRadius: 8,
          padding: 12,
          fontSize: 16,
        }}
      />

      <TextInput
        placeholder="ID de congregación (UUID)"
        value={congregationId}
        onChangeText={setCongregationId}
        autoCapitalize="none"
        style={{
          borderWidth: 1,
          borderColor: "#ccc",
          borderRadius: 8,
          padding: 12,
          fontSize: 16,
        }}
      />

      <Button
        title={loading ? "Creando cuenta..." : "Registrarse"}
        onPress={handleRegister}
        disabled={loading}
      />

      <Pressable onPress={() => router.replace("/auth/login")} style={{ alignItems: "center" }}>
        <Text style={{ color: "#007AFF" }}>¿Ya tiene cuenta? Inicie sesión</Text>
      </Pressable>
    </View>
  );
}
