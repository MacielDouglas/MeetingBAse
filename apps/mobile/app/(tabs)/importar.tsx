import { useState, useEffect } from "react";
import { Alert, Button, ScrollView, Text, View, TouchableOpacity } from "react-native";
import * as DocumentPicker from "expo-document-picker";
import { File } from "expo-file-system";
import { useRouter } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import es from "../../i18n/es.json";
import { fmtDate } from "../../lib/formatDate";
import {
  API_URL,
  getCongregationId,
  confirmImport,
  deleteImport,
  getUploadedFiles,
  isNetworkError,
  mergeImports,
  uploadJwpub,
  uploadJwpubFile,
  type ConfirmResult,
  type UploadPreview,
  type UploadedFileInfo,
} from "../../lib/api";
import { PreviewList } from "../../components/PreviewList";

const KIND_LABELS: Record<string, string> = {
  mwb: "Medio semana (MWB)",
  w: "Fin de semana (Atalaya)",
  s34: "Fin de semana (S-34)",
  sjj: "Cánticos (sjj)",
};

export default function Importar() {
  const [preview, setPreview] = useState<UploadPreview | null>(null);
  const [result, setResult] = useState<ConfirmResult | null>(null);
  const [offline, setOffline] = useState(false);
  const queryClient = useQueryClient();
  const router = useRouter();

  const uploaded = useQuery({
    queryKey: ["uploadedFiles", getCongregationId()],
    queryFn: () => getUploadedFiles(getCongregationId()),
  });

  const upload = useMutation({
    mutationFn: async (input: { uri?: string; name?: string; file?: File }) => {
      if (input.file) return uploadJwpubFile(input.file, "application/octet-stream", getCongregationId());
      return uploadJwpub(input.uri ?? "", input.name ?? "archivo.jwpub");
    },
    onSuccess: (data) => {
      setPreview(data);
      setResult(null);
      setOffline(false);
      uploaded.refetch();
    },
    onError: (e) => {
      console.log("[importar] upload error:", e);
      setOffline(isNetworkError(e));
    },
  });

  const merge = useMutation({
    mutationFn: (jobIds: string[]) => mergeImports(jobIds, getCongregationId()),
    onSuccess: (data) => {
      setPreview(data);
      setResult(null);
    },
    onError: (e) => {
      console.log("[importar] merge error:", e);
    },
  });

  const del = useMutation({
    mutationFn: (jobId: string) => deleteImport(jobId, getCongregationId()),
    onSuccess: () => {
      uploaded.refetch();
      setPreview(null);
    },
  });

  const confirm = useMutation({
    mutationFn: (jobId: string) => confirmImport(jobId),
    onSuccess: (data) => {
      setResult(data);
      setOffline(false);
      uploaded.refetch();
    },
    onError: (e) => {
      setOffline(isNetworkError(e));
    },
  });

  const files: (UploadedFileInfo & { job_id: string })[] = uploaded.data?.files ?? [];
  const jobIds: string[] = files.map((f) => f.job_id);
  const canMerge = files.length >= 2;

  async function pickFile() {
    setOffline(false);
    try {
      const res = await File.pickFileAsync();
      if (!res.canceled && res.result) {
        const f = res.result;
        upload.mutate({ file: f });
        return;
      }
      if (res.canceled) return;
    } catch {}
    const picked = await DocumentPicker.getDocumentAsync({
      type: "*/*",
      copyToCacheDirectory: true,
    });
    if (picked.canceled || !picked.assets?.[0]) return;
    const asset = picked.assets[0];
    upload.mutate({ uri: asset.uri, name: asset.name });
  }

  function handleMerge() {
    if (jobIds.length < 2) return;
    merge.mutate(jobIds);
  }

  return (
    <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
        <TouchableOpacity onPress={() => router.back()} style={{ padding: 8 }}>
          <Text style={{ fontSize: 18 }}>{es["Volver"]}</Text>
        </TouchableOpacity>
        <Text style={{ fontSize: 20, fontWeight: "bold" }}>{es["Importar"]}</Text>
      </View>
      <Text style={{ fontSize: 12, color: "#666" }}>API: {API_URL}</Text>

      {/* Uploaded files list */}
      {files.length > 0 && (
        <View style={{ gap: 6 }}>
          <Text style={{ fontWeight: "bold" }}>{es["Archivos subidos"]}:</Text>
          {files.map((f) => (
            <View
              key={f.job_id}
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "center",
                paddingVertical: 4,
                borderBottomWidth: 1,
                borderColor: "#eee",
              }}
            >
              <Text style={{ flex: 1 }}>
                {KIND_LABELS[f.kind] ?? f.kind}: {f.filename}
              </Text>
              <Button
                title="X"
                onPress={() => del.mutate(f.job_id)}
              />
            </View>
          ))}
        </View>
      )}

      <Button
        title={es["Seleccionar archivo .jwpub"]}
        onPress={pickFile}
        disabled={upload.isPending}
      />

      {upload.isPending ? <Text>{es["Subiendo..."]}</Text> : null}

      {upload.isError ? (
        <View style={{ gap: 4 }}>
          <Text>
            {es["Error al subir el archivo"]}:{" "}
            {(upload.error as Error)?.message ?? ""}
          </Text>
        </View>
      ) : null}

      {upload.data?.replaced ? (
        <Text style={{ color: "#b45309" }}>
          {es["Archivo reemplazado"]}
        </Text>
      ) : null}

      {/* Merge button */}
      {canMerge && !preview && (
        <Button
          title={merge.isPending ? es["Fusionando..."] : es["Fusionar archivos"]}
          onPress={handleMerge}
          disabled={merge.isPending}
        />
      )}

      {merge.isError ? (
        <Text style={{ color: "red" }}>
          {es["Error al fusionar"]}: {(merge.error as Error)?.message ?? ""}
        </Text>
      ) : null}

      {/* Preview */}
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

      {/* Result */}
      {result ? (
        <View style={{ gap: 8 }}>
          <Text style={{ fontSize: 16, fontWeight: "bold" }}>
            {es["Importación confirmada"]} ({result.meetings.length})
          </Text>
          <Text>
            {es["Persistencia"]}: {result.persistencia ?? "memoria"}
          </Text>
          {result.persistencia !== "neon" ? (
            <Text style={{ color: "#b45309" }}>
              {es["Solo en memoria (reiniciar la API lo borra)"]}
            </Text>
          ) : null}
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
                {m.semana_label} · {fmtDate(m.fecha)}
              </Text>
              <Text>
                {m.tipo} · {es["Sala A"]} · {m.parts.length} partes
              </Text>
            </View>
          ))}
        </View>
      ) : null}

      {files.length === 0 && !preview && !result ? (
        <Text>{es["Selecciona un archivo para comenzar"]}</Text>
      ) : null}

      <Text>{es["Reuniones en borrador"]}</Text>
    </ScrollView>
  );
}
