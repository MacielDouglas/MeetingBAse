import { useState } from "react";
import { Button, ScrollView, Text, View } from "react-native";
import * as DocumentPicker from "expo-document-picker";
import { File } from "expo-file-system";
import { useMutation } from "@tanstack/react-query";
import es from "../../i18n/es.json";
import {
  API_URL,
  confirmImport,
  isNetworkError,
  uploadJwpub,
  uploadJwpubFile,
  type ConfirmResult,
  type UploadPreview,
} from "../../lib/api";
import { PreviewList } from "../../components/PreviewList";

// Pantalla Importar (Fase 1): solo subida .jwpub, parsing en la API.
// Sala siempre A, sin selector. Designar exige online.
export default function Importar() {
  const [fileName, setFileName] = useState<string | null>(null);
  const [fileUri, setFileUri] = useState<string | null>(null);
  const [preview, setPreview] = useState<UploadPreview | null>(null);
  const [result, setResult] = useState<ConfirmResult | null>(null);
  const [offline, setOffline] = useState(false);

  const upload = useMutation({
    mutationFn: async (input: { uri?: string; name?: string; file?: File }) => {
      if (input.file) return uploadJwpubFile(input.file);
      return uploadJwpub(input.uri ?? "", input.name ?? "archivo.jwpub");
    },
    onSuccess: (data) => {
      setPreview(data);
      setResult(null);
      setOffline(false);
    },
    onError: (e) => {
      console.log("[importar] upload error:", e);
      setOffline(isNetworkError(e));
    },
  });

  const confirm = useMutation({
    mutationFn: (jobId: string) => confirmImport(jobId),
    onSuccess: (data) => {
      setResult(data);
      setOffline(false);
    },
    onError: (e) => {
      setOffline(isNetworkError(e));
    },
  });

  async function pickFile() {
    setOffline(false);
    // Picker nativo de expo-file-system (iOS + Android): devuelve un File
    // legible sin copia intermedia. Evita "isn't readable" / "Missing READ
    // permission" de DocumentPicker en Android (Expo Go).
    try {
      const res = await File.pickFileAsync();
      if (!res.canceled && res.result) {
        const f = res.result;
        setFileName(f.name ?? "archivo.jwpub");
        setFileUri(f.uri);
        setPreview(null);
        setResult(null);
        upload.mutate({ file: f });
        return;
      }
      if (res.canceled) return;
    } catch {}
    // Fallback DocumentPicker.
    const picked = await DocumentPicker.getDocumentAsync({
      type: "*/*",
      copyToCacheDirectory: true,
    });
    if (picked.canceled || !picked.assets?.[0]) return;
    const asset = picked.assets[0];
    setFileName(asset.name);
    setFileUri(asset.uri);
    setPreview(null);
    setResult(null);
    upload.mutate({ uri: asset.uri, name: asset.name });
  }

  return (
    <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
      <Text style={{ fontSize: 20, fontWeight: "bold" }}>{es["Importar"]}</Text>
      <Text>
        {es["Sala fija"]}: {es["Sala A"]}
      </Text>
      <Text style={{ fontSize: 12, color: "#666" }}>API: {API_URL}</Text>

      <Button
        title={es["Seleccionar archivo .jwpub"]}
        onPress={pickFile}
        disabled={upload.isPending}
      />

      {fileName ? (
        <Text>
          {es["Archivo seleccionado"]}: {fileName}
        </Text>
      ) : (
        <Text>{es["Selecciona un archivo para comenzar"]}</Text>
      )}

      {upload.isPending ? <Text>{es["Subiendo..."]}</Text> : null}
      {upload.isError ? (
        <View style={{ gap: 4 }}>
          <Text>
            {es["Error al subir el archivo"]}:{" "}
            {(upload.error as Error)?.message ?? ""}
          </Text>
          <Text style={{ fontSize: 12, color: "#666" }}>API: {API_URL}</Text>
        </View>
      ) : null}

      {offline ? (
        <Text>{es["Necesitas conexión para asignar"]}</Text>
      ) : null}

      {preview ? (
        <View style={{ gap: 8 }}>
          <Text style={{ fontSize: 16, fontWeight: "bold" }}>
            {es["Vista previa"]} ({preview.weeks.length})
          </Text>
          <PreviewList weeks={preview.weeks} />
          <Button
            title={confirm.isPending ? es["Confirmando..."] : es["Confirmar"]}
            onPress={() => confirm.mutate(preview.job_id)}
            disabled={confirm.isPending}
          />
        </View>
      ) : null}

      {confirm.isError ? (
        <Text>
          {es["Error al confirmar"]}: {(confirm.error as Error)?.message ?? ""}
        </Text>
      ) : null}

      {result ? (
        <View style={{ gap: 8 }}>
          <Text style={{ fontSize: 16, fontWeight: "bold" }}>
            {es["Importación confirmada"]} ({result.meetings.length})
          </Text>
          {result.meetings.map((m) => (
            <View
              key={m.id}
              style={{
                paddingVertical: 8,
                borderBottomWidth: 1,
                borderColor: "#ddd",
              }}
            >
              <Text style={{ fontWeight: "bold" }}>
                {m.semana_label} · {m.fecha}
              </Text>
              <Text>
                {m.tipo} · {es["Sala A"]} · {m.parts.length} partes
              </Text>
            </View>
          ))}
          {fileUri ? null : null}
        </View>
      ) : null}

      <Text>{es["Reuniones en borrador"]}</Text>
    </ScrollView>
  );
}
