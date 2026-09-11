import { useState } from "react";
import { Button, FlatList, Text, View, Alert } from "react-native";
import { useQuery, useMutation } from "@tanstack/react-query";
import * as Sharing from "expo-sharing";
import * as FileSystem from "expo-file-system/legacy";
import { useAuth, authHeaders, getCongregationId } from "../../lib/auth";
import { API_URL } from "../../lib/api";
import es from "../../i18n/es.json";

interface Template {
  id: string;
  name: string;
  description: string;
}

export default function ExportarScreen() {
  const { user, token } = useAuth();
  const congId = getCongregationId(user);
  const [htmlContent, setHtmlContent] = useState<string | null>(null);

  const templates = useQuery({
    queryKey: ["templates", congId],
    queryFn: async () => {
      const res = await fetch(`${API_URL}/c/${congId}/templates`, {
        headers: authHeaders(token),
      });
      const body = await res.json();
      return (body.templates ?? []) as Template[];
    },
  });

  const generate = useMutation({
    mutationFn: async (templateId: string) => {
      const res = await fetch(`${API_URL}/c/${congId}/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders(token) },
        body: JSON.stringify({ template_id: templateId }),
      });
      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.error ?? "Error al generar");
      }
      return res.text();
    },
    onSuccess: (html) => {
      setHtmlContent(html);
    },
    onError: (e) => {
      Alert.alert("Error", (e as Error).message);
    },
  });

  async function handleShare() {
    if (!htmlContent) return;
    try {
      const fileUri = `${FileSystem.cacheDirectory}meeting-base-export.html`;
      await FileSystem.writeAsStringAsync(fileUri, htmlContent, {
        encoding: FileSystem.EncodingType.UTF8,
      });
      await Sharing.shareAsync(fileUri, {
        mimeType: "text/html",
        dialogTitle: "Compartir programa",
      });
    } catch (e) {
      Alert.alert("Error", "No se pudo compartir");
    }
  }

  return (
    <View style={{ flex: 1, padding: 16, gap: 12 }}>
      <Text style={{ fontSize: 20, fontWeight: "bold" }}>Exportar programa</Text>
      <Text style={{ color: "#666" }}>Seleccione un template para generar el documento</Text>

      {templates.isLoading ? <Text>Cargando templates...</Text> : null}

      <FlatList
        data={templates.data ?? []}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View
            style={{
              padding: 12,
              borderBottomWidth: 1,
              borderColor: "#eee",
            }}
          >
            <Text style={{ fontWeight: "bold" }}>{item.name}</Text>
            <Text style={{ fontSize: 12, color: "#666", marginBottom: 8 }}>
              {item.description}
            </Text>
            <Button
              title={generate.isPending ? "Generando..." : "Generar"}
              onPress={() => generate.mutate(item.id)}
              disabled={generate.isPending}
            />
          </View>
        )}
      />

      {htmlContent ? (
        <View style={{ gap: 8 }}>
          <Text style={{ fontWeight: "bold" }}>Documento generado</Text>
          <Button title="Compartir" onPress={handleShare} />
          <Button
            title="Cerrar vista previa"
            onPress={() => setHtmlContent(null)}
            color="#888"
          />
        </View>
      ) : null}
    </View>
  );
}
