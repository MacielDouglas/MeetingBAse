// Componentes de asignación: PresidentSection + PartCard.
// Extraídos de asignar.tsx para respetar límite de 400 líneas.

import { useState, useMemo } from "react";
import { Button, FlatList, Text, View, TouchableOpacity } from "react-native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import es from "../i18n/es.json";
import {
  assignPart,
  getPublisherHistory,
  isNetworkError,
  suggestCandidates,
  suggestHelpers,
  type AssignResult,
  type PublisherHistory,
  type SuggestCandidate,
} from "../lib/api";
import type { PublisherRef } from "../hooks/usePublishers";
import { fmtDate } from "../lib/formatDate";

// ── Re-export filters + helpers ──
export interface PartFilter {
  maleOnly?: boolean;
  ebcOnly?: boolean;
  helperRequired?: boolean;
  helperSameSex?: boolean;
  helperFamilyAllowed?: boolean;
}

const MALE = new Set(["m", "hombre", "varon", "varón", "masculino"]);
const EBC = new Set(["anciano", "siervo ministerial", "siervo_ministerial", "siervo"]);
export const isMale = (sexo: string) => MALE.has(sexo.trim().toLowerCase());
export const canEbc = (cargo: string) => EBC.has(cargo.trim().toLowerCase());

export const PART_FILTERS: Record<string, PartFilter> = {
  mwb_tgw_talk: {},
  mwb_tgw_gems: {},
  mwb_tgw_bread: { maleOnly: true },
  mwb_ayf_iniciar: {},
  mwb_ayf_cultivar: {},
  mwb_ayf_explicar_discurso: {},
  mwb_ayf_explicar_demo: { helperRequired: true, helperSameSex: true, helperFamilyAllowed: true },
  mwb_lc_part1: {},
  mwb_lc_part2: {},
  mwb_lc_cbs: { ebcOnly: true },
  wk_oracion: {},
  wk_presidente: { ebcOnly: true },
  wk_discurso_publico: {},
  wk_sentinela_dirigente: { ebcOnly: true },
  wk_sentinela_leitor: {},
  w_estudio: { ebcOnly: true },
};

export function matchesFilter(p: PublisherRef, f: PartFilter): boolean {
  if (f.maleOnly && !isMale(p.sexo)) return false;
  if (f.ebcOnly && !canEbc(p.cargo ?? "")) return false;
  return true;
}

export function filterHelpers(
  pubs: PublisherRef[],
  titular: PublisherRef | undefined,
  f: PartFilter,
  titularId: string
): PublisherRef[] {
  if (!titular) return [];
  return pubs.filter((p) => {
    if (p.id === titularId) return false;
    if (titular.familiaId && p.familiaId && titular.familiaId === p.familiaId) return false;
    if (f.helperSameSex) {
      if (p.sexo.trim().toLowerCase() !== titular.sexo.trim().toLowerCase()) return false;
    }
    return true;
  });
}

// ── Seção do Presidente ──

export function PresidentSection({
  part,
  publishers,
  congId,
  offline,
  getPubName,
}: {
  part: { id: string; titulo: string; tipo_clave: string | null; titular_id: string | null };
  publishers: PublisherRef[];
  congId: string;
  offline: boolean;
  getPubName: (id: string | null) => string;
}) {
  const client = useQueryClient();
  const eligible = useMemo(
    () => publishers.filter((p) => matchesFilter(p, PART_FILTERS.wk_presidente ?? {})),
    [publishers]
  );
  const [selected, setSelected] = useState<string | null>(part.titular_id);
  const [suggestMsg, setSuggestMsg] = useState<string | null>(null);
  const [result, setResult] = useState<AssignResult | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const mut = useMutation({
    mutationFn: () =>
      assignPart(congId, part.id, { titular_id: selected as string, ayudante_id: null }),
    onSuccess: async (data) => {
      setResult(data);
      setFormError(null);
      await client.invalidateQueries({ queryKey: ["programa", congId] });
    },
    onError: (e) => {
      setResult(null);
      const msg = (e as Error).message;
      if (isNetworkError(e)) setFormError(es["Necesitas conexión para asignar"]);
      else setFormError(msg);
    },
  });

  const suggestMut = useMutation({
    mutationFn: () => suggestCandidates(congId, part.id),
    onSuccess: (list: SuggestCandidate[]) => {
      if (list.length === 0) { setSuggestMsg(es["Sin candidatos"]); return; }
      setSelected(list[0].id);
      setSuggestMsg(list.slice(0, 3).map((c) => `${c.nombre} (${c.motivo})`).join(" · "));
    },
    onError: (e) => setSuggestMsg((e as Error).message),
  });

  return (
    <View style={{ padding: 12, backgroundColor: "#eaf2f8", borderRadius: 8, borderWidth: 1, borderColor: "#aed6f1", gap: 6 }}>
      <Text style={{ fontWeight: "bold", fontSize: 15 }}>👤 {es["Presidente"]}</Text>
      {part.titulo ? <Text style={{ fontSize: 12, color: "#555" }}>{part.titulo}</Text> : null}

      <Button
        title={suggestMut.isPending ? es["Sugiriendo..."] : es["Sugerir"]}
        onPress={() => { setSuggestMsg(null); suggestMut.mutate(); }}
        disabled={suggestMut.isPending || offline}
      />
      {suggestMsg ? <Text style={{ fontSize: 12, color: "#666" }}>{suggestMsg}</Text> : null}

      <FlatList
        data={eligible}
        keyExtractor={(item) => item.id}
        horizontal
        showsHorizontalScrollIndicator={false}
        renderItem={({ item }) => (
          <Button
            title={item.nombre}
            onPress={() => { setSelected(item.id); setResult(null); }}
            color={selected === item.id ? "#1a5276" : "#ccc"}
          />
        )}
      />
      {selected ? (
        <Text style={{ fontSize: 12, color: "#666" }}>Seleccionado: {getPubName(selected)}</Text>
      ) : null}

      <Button
        title={mut.isPending ? es["Asignando..."] : es["Asignar presidente"]}
        onPress={() => {
          setFormError(null);
          setResult(null);
          if (offline) { setFormError(es["Necesitas conexión para asignar"]); return; }
          if (!selected) { setFormError("Seleccione el presidente"); return; }
          mut.mutate();
        }}
        disabled={mut.isPending || offline}
      />
      {formError ? <Text style={{ color: "red", fontSize: 12 }}>{formError}</Text> : null}
      {result ? (
        <View style={{ gap: 2 }}>
          <Text style={{ fontWeight: "bold", fontSize: 12 }}>{es["Asignación guardada"]}</Text>
          {result.warnings.map((w, i) => (
            <Text key={`${w.tipo}-${i}`} style={{ fontSize: 12 }}>⚠ {w.mensaje_es}</Text>
          ))}
        </View>
      ) : null}
    </View>
  );
}

// ── Card de cada parte ──

export function PartCard({
  part,
  publishers,
  publishersAll,
  congId,
  offline,
  getPubName,
  expanded,
  onToggle,
}: {
  part: { id: string; orden: number; titulo: string; tipo_clave: string | null; requiere_ayudante: boolean; titular_id: string | null; ayudante_id: string | null };
  publishers: PublisherRef[];
  publishersAll: PublisherRef[];
  congId: string;
  offline: boolean;
  getPubName: (id: string | null) => string;
  expanded: boolean;
  onToggle: () => void;
}) {
  const client = useQueryClient();
  const [localTitular, setLocalTitular] = useState<string | null>(part.titular_id);
  const [localAyudante, setLocalAyudante] = useState<string | null>(part.ayudante_id);
  const [suggestMsg, setSuggestMsg] = useState<string | null>(null);
  const [helperSuggestMsg, setHelperSuggestMsg] = useState<string | null>(null);
  const [result, setResult] = useState<AssignResult | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const tipoClave = part.tipo_clave ?? "";
  const filter = PART_FILTERS[tipoClave];
  const needsHelper = filter?.helperRequired || part.requiere_ayudante;

  const eligible = useMemo(
    () => (filter ? publishers.filter((p) => matchesFilter(p, filter)) : publishers),
    [publishers, filter]
  );

  const titular = publishersAll.find((p) => p.id === localTitular);
  const helperEligible = useMemo(
    () => (needsHelper && filter ? filterHelpers(publishers, titular, filter, localTitular ?? "") : publishers.filter((p) => p.id !== localTitular)),
    [publishers, titular, filter, needsHelper, localTitular]
  );

  const mut = useMutation({
    mutationFn: () =>
      assignPart(congId, part.id, {
        titular_id: localTitular as string,
        ayudante_id: localAyudante,
      }),
    onSuccess: async (data) => {
      setResult(data);
      setFormError(null);
      await client.invalidateQueries({ queryKey: ["programa", congId] });
    },
    onError: (e) => {
      setResult(null);
      const msg = (e as Error).message;
      if (isNetworkError(e)) setFormError(es["Necesitas conexión para asignar"]);
      else if (/no encontrada/i.test(msg)) setFormError(`${msg} — sincronice el Programa e intente de nuevo`);
      else setFormError(msg);
    },
  });

  const suggestMut = useMutation({
    mutationFn: () => suggestCandidates(congId, part.id),
    onSuccess: (list: SuggestCandidate[]) => {
      if (list.length === 0) { setSuggestMsg(es["Sin candidatos"]); return; }
      setLocalTitular(list[0].id);
      setSuggestMsg(list.slice(0, 3).map((c) => `${c.nombre} (${c.motivo})`).join(" · "));
    },
    onError: (e) => setSuggestMsg((e as Error).message),
  });

  const suggestHelperMut = useMutation({
    mutationFn: () => suggestHelpers(congId, part.id, localTitular as string),
    onSuccess: (list: SuggestCandidate[]) => {
      if (list.length === 0) { setHelperSuggestMsg(es["Sin candidatos"]); return; }
      setLocalAyudante(list[0].id);
      setHelperSuggestMsg(list.slice(0, 3).map((c) => `${c.nombre} (${c.motivo})`).join(" · "));
    },
    onError: (e) => setHelperSuggestMsg((e as Error).message),
  });

  const hist = useQuery({
    queryKey: ["history", congId, localTitular],
    queryFn: () => getPublisherHistory(congId, localTitular as string),
    enabled: !!congId && !!localTitular && !offline,
    retry: 1,
    staleTime: 30_000,
  });
  const h: PublisherHistory | undefined = hist.data;

  return (
    <View style={{ padding: 10, backgroundColor: "#fff", borderRadius: 8, borderWidth: 1, borderColor: "#ddd" }}>
      <TouchableOpacity onPress={onToggle}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <Text style={{ fontWeight: "600", flex: 1 }}>
            {part.orden}. {part.titulo}
          </Text>
          <Text style={{ fontSize: 12, color: "#888" }}>{expanded ? "▲" : "▼"}</Text>
        </View>
        {part.titular_id ? (
          <Text style={{ fontSize: 12, color: "#666", marginTop: 2 }}>
            {getPubName(part.titular_id)}
            {part.ayudante_id ? ` + ${getPubName(part.ayudante_id)}` : ""}
          </Text>
        ) : null}
      </TouchableOpacity>

      {expanded ? (
        <View style={{ gap: 6, marginTop: 8 }}>
          <Text style={{ fontWeight: "600" }}>{es["Titular"]}</Text>
          <Button
            title={suggestMut.isPending ? es["Sugiriendo..."] : es["Sugerir"]}
            onPress={() => { setSuggestMsg(null); suggestMut.mutate(); }}
            disabled={suggestMut.isPending || offline}
          />
          {suggestMsg ? <Text style={{ fontSize: 12, color: "#666" }}>{suggestMsg}</Text> : null}
          <FlatList
            data={eligible}
            keyExtractor={(item) => item.id}
            horizontal
            showsHorizontalScrollIndicator={false}
            renderItem={({ item }) => (
              <Button
                title={item.nombre}
                onPress={() => { setLocalTitular(item.id); setResult(null); }}
                color={localTitular === item.id ? "#1a5276" : "#ccc"}
              />
            )}
          />
          {localTitular ? (
            <Text style={{ fontSize: 12, color: "#666" }}>
              {getPubName(localTitular)}
              {h ? ` · ${h.total} designaciones${h.last_fecha ? `, última: ${fmtDate(h.last_fecha)}` : ""}` : ""}
            </Text>
          ) : null}

          {needsHelper ? (
            <>
              <Text style={{ fontWeight: "600" }}>{es["Ayudante"]}</Text>
              <Button
                title={suggestHelperMut.isPending ? es["Sugiriendo ayudante..."] : es["Sugerir ayudante"]}
                onPress={() => { setHelperSuggestMsg(null); suggestHelperMut.mutate(); }}
                disabled={suggestHelperMut.isPending || offline || !localTitular}
              />
              {helperSuggestMsg ? <Text style={{ fontSize: 12, color: "#666" }}>{helperSuggestMsg}</Text> : null}
              <FlatList
                data={helperEligible}
                keyExtractor={(item) => item.id}
                horizontal
                showsHorizontalScrollIndicator={false}
                renderItem={({ item }) => (
                  <Button
                    title={item.nombre}
                    onPress={() => { setLocalAyudante(item.id); setResult(null); }}
                    color={localAyudante === item.id ? "#7d3c98" : "#ccc"}
                  />
                )}
              />
              {localAyudante ? (
                <Text style={{ fontSize: 12, color: "#666" }}>
                  {getPubName(localAyudante)}
                  <Button title=" X" onPress={() => setLocalAyudante(null)} color="#888" />
                </Text>
              ) : null}
            </>
          ) : null}

          <Button
            title={mut.isPending ? es["Asignando..."] : es["Asignar"]}
            onPress={() => {
              setFormError(null);
              setResult(null);
              if (offline) { setFormError(es["Necesitas conexión para asignar"]); return; }
              if (!localTitular) { setFormError("Seleccione un titular"); return; }
              if (needsHelper && !localAyudante) { setFormError("Seleccione un ayudante"); return; }
              mut.mutate();
            }}
            disabled={mut.isPending || offline}
          />
          {formError ? <Text style={{ color: "red", fontSize: 12 }}>{formError}</Text> : null}
          {result ? (
            <View style={{ gap: 2 }}>
              <Text style={{ fontWeight: "bold", fontSize: 12 }}>{es["Asignación guardada"]}</Text>
              {result.warnings.map((w, i) => (
                <Text key={`${w.tipo}-${i}`} style={{ fontSize: 12 }}>⚠ {w.mensaje_es}</Text>
              ))}
            </View>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}
