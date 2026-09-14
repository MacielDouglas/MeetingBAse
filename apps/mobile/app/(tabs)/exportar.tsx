import { useState } from "react";
import { Button, FlatList, Text, View, Alert } from "react-native";
import { useQuery, useMutation } from "@tanstack/react-query";
import * as Sharing from "expo-sharing";
import * as Print from "expo-print";
import * as FileSystem from "expo-file-system/legacy";
import { API_URL, authHeaders, getCongregationId, isNetworkError } from "../../lib/api";
import { SkeletonRow } from "../../components/Skeleton";
import es from "../../i18n/es.json";

interface Template { id: string; name: string; description: string; }

export default function ExportarScreen() {
  const congId = getCongregationId();
  const [htmlContent, setHtmlContent] = useState<string | null>(null);

  const templates = useQuery({
    queryKey: ["templates", congId],
    queryFn: async () => {
      const res = await fetch(`${API_URL}/c/${congId}/templates`, { headers: authHeaders() });
      const body = await res.json();
      return (body.templates ?? []) as Template[];
    },
  });

  const generate = useMutation({
    mutationFn: async (templateId: string) => {
      const res = await fetch(`${API_URL}/c/${congId}/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ template_id: templateId }),
      });
      if (!res.ok) { const body = await res.json(); throw new Error(body.error ?? "Error al generar"); }
      return res.text();
    },
    onSuccess: (html) => { setHtmlContent(html); },
    onError: (e) => {
      const msg = isNetworkError(e) ? "Sin conexión. Intente más tarde." : (e as Error).message;
      Alert.alert("Error", msg);
    },
  });

  async function handleShare() {
    if (!htmlContent) return;
    try {
      const fileUri = `${FileSystem.cacheDirectory}meeting-base-export.html`;
      await FileSystem.writeAsStringAsync(fileUri, htmlContent, { encoding: FileSystem.EncodingType.UTF8 });
      await Sharing.shareAsync(fileUri, { mimeType: "text/html", dialogTitle: "Compartir programa" });
    } catch {
      Alert.alert("Error", "No se pudo compartir");
    }
  }

  async function handlePrint() {
    if (!htmlContent) return;
    try {
      await Print.printAsync({ html: htmlContent });
    } catch {
      Alert.alert("Error", "No se pudo imprimir");
    }
  }

  async function handlePrintToPdf() {
    if (!htmlContent) return;
    try {
      const result = await Print.printToFileAsync({ html: htmlContent });
      await Sharing.shareAsync(result.uri, { mimeType: "application/pdf", dialogTitle: "Compartir PDF" });
    } catch {
      Alert.alert("Error", "No se pudo generar el PDF");
    }
  }

  async function handleExportIcal() {
    try {
      const res = await fetch(`${API_URL}/c/${congId}/ical`, { headers: authHeaders() });
      if (!res.ok) throw new Error("Error al exportar iCal");
      const ical = await res.text();
      const fileUri = `${FileSystem.cacheDirectory}meeting-base.ics`;
      await FileSystem.writeAsStringAsync(fileUri, ical, { encoding: FileSystem.EncodingType.UTF8 });
      await Sharing.shareAsync(fileUri, { mimeType: "text/calendar", dialogTitle: "Exportar calendario" });
    } catch (e) {
      Alert.alert("Error", isNetworkError(e) ? "Sin conexión" : (e as Error).message);
    }
  }

  return (
    <View style={{ flex: 1, padding: 16, gap: 12 }}>
      <Text style={{ fontSize: 20, fontWeight: "bold" }}>{es["Exportar"]}</Text>
      <Text style={{ color: "#666" }}>Seleccione un template para generar el documento</Text>

      {templates.isLoading ? <SkeletonRow lines={3} /> : null}

      {templates.isError ? (
        <Text style={{ color: "#e74c3c", textAlign: "center" }}>
          {isNetworkError(templates.error) ? es["Sin conexión"] : "Error al cargar templates"}
        </Text>
      ) : null}

      <FlatList
        data={templates.data ?? []}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={{ padding: 12, borderBottomWidth: 1, borderColor: "#eee" }}>
            <Text style={{ fontWeight: "bold" }}>{item.name}</Text>
            <Text style={{ fontSize: 12, color: "#666", marginBottom: 8 }}>{item.description}</Text>
            <Button title={generate.isPending ? "Generando..." : "Generar"} onPress={() => generate.mutate(item.id)} disabled={generate.isPending} />
          </View>
        )}
      />

      <View style={{ gap: 8, borderTopWidth: 1, borderTopColor: "#eee", paddingTop: 12 }}>
        <Text style={{ fontWeight: "bold" }}>Otros formatos</Text>
        <Button title="Exportar calendario (.ics)" onPress={handleExportIcal} />
      </View>

      {htmlContent ? (
        <View style={{ gap: 8 }}>
          <Text style={{ fontWeight: "bold" }}>{es["Documento generado"]}</Text>
          <Button title={es["Compartir"]} onPress={handleShare} />
          <Button title="Imprimir" onPress={handlePrint} />
          <Button title="Exportar PDF" onPress={handlePrintToPdf} />
          <Button title="Cerrar vista previa" onPress={() => setHtmlContent(null)} color="#888" />
        </View>
      ) : null}
    </View>
  );
}
