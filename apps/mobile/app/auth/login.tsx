import { useState } from "react";
import { Button, Text, TextInput, View, Alert, Pressable } from "react-native";
import { useRouter } from "expo-router";
import { useAuth } from "../../lib/auth";
import { resetPassword } from "../../lib/api";

export default function LoginScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const router = useRouter();

  async function handleLogin() {
    if (!email || !password) {
      Alert.alert("Error", "Email y contraseña requeridos");
      return;
    }
    setLoading(true);
    try {
      await login(email, password);
      router.replace("/(tabs)");
    } catch (e) {
      Alert.alert("Error", (e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function handleForgotPassword() {
    if (!email) {
      Alert.alert("Info", "Ingrese su email y presione Olvidé mi contraseña");
      return;
    }
    Alert.alert("Restablecer contraseña", `Se enviará una nueva contraseña a ${email}`, [
      { text: "Cancelar" },
      {
        text: "Aceptar",
        onPress: async () => {
          try {
            const result = await resetPassword(email);
            if (result.tempPassword) {
              Alert.alert("Contraseña temporal", `Su nueva contraseña es: ${result.tempPassword}\n\nCambiela después de iniciar sesión.`);
            } else {
              Alert.alert("Info", result.message);
            }
          } catch (e) {
            Alert.alert("Error", (e as Error).message);
          }
        },
      },
    ]);
  }

  return (
    <View style={{ flex: 1, justifyContent: "center", padding: 24, gap: 16 }}>
      <Text style={{ fontSize: 24, fontWeight: "bold", textAlign: "center" }}>
        Meeting Base
      </Text>
      <Text style={{ textAlign: "center", color: "#666" }}>
        Inicie sesión para continuar
      </Text>

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

      <Button
        title={loading ? "Iniciando..." : "Iniciar sesión"}
        onPress={handleLogin}
        disabled={loading}
      />

      <Pressable onPress={handleForgotPassword} style={{ alignItems: "center" }}>
        <Text style={{ color: "#e74c3c" }}>Olvidé mi contraseña</Text>
      </Pressable>

      <Pressable onPress={() => router.replace("/auth/register")} style={{ alignItems: "center" }}>
        <Text style={{ color: "#007AFF" }}>¿No tiene cuenta? Regístrese</Text>
      </Pressable>
    </View>
  );
}
