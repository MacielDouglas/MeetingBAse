// Asignar — fluxo: reunião → presidente → partes com filtros.
// Cânticos não são designáveis. Online-only.

import { useState, useMemo } from "react";
import { Button, FlatList, ScrollView, Text, View, TouchableOpacity } from "react-native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import es from "../../i18n/es.json";
import {
  assignPart,
  getCongregationId,
  getPrayers,
  getPublisherHistory,
  getUnavailability,
  isNetworkError,
  savePrayer,
  suggestCandidates,
  suggestHelpers,
  type AssignResult,
  type PublisherHistory,
  type SuggestCandidate,
  type SyncPrayer,
} from "../../lib/api";
import { usePrograma } from "../../hooks/usePrograma";
import { usePublishers, type PublisherRef } from "../../hooks/usePublishers";

// ── Regras de elegibilidade (client-side) ──

const MALE = new Set(["m", "hombre", "varon", "varón", "masculino"]);
const EBC = new Set(["anciano", "siervo ministerial", "siervo_ministerial", "siervo"]);
const isMale = (sexo: string) => MALE.has(sexo.trim().toLowerCase());
const canEbc = (cargo: string) => EBC.has(cargo.trim().toLowerCase());

interface PartFilter {
  maleOnly?: boolean;
  ebcOnly?: boolean;
  helperRequired?: boolean;
  helperSameSex?: boolean;
  helperFamilyAllowed?: boolean;
}

const PART_FILTERS: Record<string, PartFilter> = {
  // Tesoros — qualquer publicador
  mwb_tgw_talk: {},
  mwb_tgw_gems: {},
  mwb_tgw_bread: { maleOnly: true },
  // AYF — qualquer publicador
  mwb_ayf_iniciar: {},
  mwb_ayf_cultivar: {},
  mwb_ayf_explicar_discurso: {},
  mwb_ayf_explicar_demo: { helperRequired: true, helperSameSex: true, helperFamilyAllowed: true },
  // Vida — qualquer publicador
  mwb_lc_part1: {},
  mwb_lc_part2: {},
  mwb_lc_cbs: { ebcOnly: true },
  // Fim de semana
  wk_oracion: {},
  wk_presidente: { ebcOnly: true },
  wk_discurso_publico: {},
  wk_sentinela_dirigente: { ebcOnly: true },
  wk_sentinela_leitor: {},
  w_estudio: { ebcOnly: true },
};

function matchesFilter(p: PublisherRef, f: PartFilter): boolean {
  if (f.maleOnly && !isMale(p.sexo)) return false;
  if (f.ebcOnly && !canEbc(p.cargo)) return false;
  return true;
}

function filterHelpers(
  pubs: PublisherRef[],
  titular: PublisherRef | undefined,
  f: PartFilter,
  titularId: string
): PublisherRef[] {
  if (!titular) return [];
  return pubs.filter((p) => {
    if (p.id === titularId) return false;
    // Family cross-validation: family members can't be helpers together
    if (titular.familiaId && p.familiaId && titular.familiaId === p.familiaId) return false;
    if (f.helperSameSex) {
      if (p.sexo.trim().toLowerCase() !== titular.sexo.trim().toLowerCase()) return false;
    }
    return true;
  });
}

// Seções do programa
const SECTION_LABELS: Record<string, string> = {
  TESOROS: "Tesoros de la Palabra de Dios",
  MAESTROS: "Haz tu mejor ministerio",
  VIDA: "Nuestra vida cristiana",
  EBC: "Estudio Bíblico de la congregación",
  SENTINELA: "Sentinela",
  ATALAYA: "Estudio de la Atalaya",
};

export default function Asignar() {
  const congId = getCongregationId();
  const { meetings, offline } = usePrograma(congId);
  const client = useQueryClient();
  const [meetingId, setMeetingId] = useState<string | null>(null);
  const [expandedPart, setExpandedPart] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [result, setResult] = useState<AssignResult | null>(null);
  const [prayerSel, setPrayerSel] = useState<{ inicial: string | null; final: string | null }>({ inicial: null, final: null });
  const [prayerMsg, setPrayerMsg] = useState<string | null>(null);

  const meeting = meetings.find((m) => m.id === meetingId) ?? null;

  const pubs = usePublishers(congId);
  const publishers = pubs.data ?? [];

  const unav = useQuery({
    queryKey: ["unavailability", congId, meeting?.fecha],
    queryFn: () => getUnavailability(congId, { fecha: meeting?.fecha }),
    enabled: !!congId && !!meeting?.fecha && !offline,
    retry: 1,
    staleTime: 30_000,
  });
  const unavIds = new Set((unav.data ?? []).map((u) => u.publisher_id));
  const available = publishers.filter((p) => !unavIds.has(p.id));

  const serverPrayers = useQuery({
    queryKey: ["prayers", congId, meetingId],
    queryFn: () => getPrayers(congId, meetingId as string),
    enabled: !!congId && !!meetingId && !offline,
    retry: 1,
    staleTime: 30_000,
  });
  const prayers: SyncPrayer[] =
    serverPrayers.data ??
    ((meeting?.prayers ?? []).map((p) => ({
      id: p.id,
      meeting_id: meetingId as string,
      tipo: p.tipo as "inicial" | "final",
      publisher_id: p.publisher_id,
    })) as SyncPrayer[]);

  const prayerMut = useMutation({
    mutationFn: (input: { tipo: "inicial" | "final"; publisher_id: string | null }) =>
      savePrayer(congId, meetingId as string, input),
    onSuccess: async () => {
      setPrayerMsg(es["Oración guardada"]);
      await client.invalidateQueries({ queryKey: ["prayers", congId, meetingId] });
      await client.invalidateQueries({ queryKey: ["programa", congId] });
    },
    onError: (e) => setPrayerMsg((e as Error).message),
  });

  // ── Auto-asignar todas ──
  const [autoAssignResult, setAutoAssignResult] = useState<string | null>(null);
  const autoAssignMut = useMutation({
    mutationFn: async () => {
      if (!meeting) return;
      let assigned = 0;
      let skipped = 0;
      for (const p of assignableParts) {
        if (p.titular_id) { skipped++; continue; }
        try {
          const candidates = await suggestCandidates(congId, p.id);
          if (candidates.length === 0) { skipped++; continue; }
          await assignPart(congId, p.id, { titular_id: candidates[0].id, ayudante_id: null });
          assigned++;
        } catch {
          skipped++;
        }
      }
      return `${es["Asignaciones"]}: ${assigned}, ${es["Omitidas"]}: ${skipped}`;
    },
    onSuccess: async (msg) => {
      setAutoAssignResult(msg ?? null);
      await client.invalidateQueries({ queryKey: ["programa", congId] });
    },
    onError: (e) => setAutoAssignResult((e as Error).message),
  });

  // Parte do presidente (wk_presidente se existir na reunião)
  const presPart = meeting?.parts.find((p) => p.tipo_clave === "wk_presidente") ?? null;

  // Parts designáveis: exclui cânticos e a parte do presidente (já tratada separadamente)
  const assignableParts = useMemo(() => {
    if (!meeting) return [];
    return meeting.parts.filter((p) => {
      const sec = (p.seccion ?? "").toUpperCase();
      if (sec === "CANCION") return false;
      if (p.tipo_clave === "wk_presidente") return false;
      return true;
    });
  }, [meeting]);

  // Agrupar por seção
  const grouped = useMemo(() => {
    const map = new Map<string, typeof assignableParts>();
    for (const p of assignableParts) {
      const sec = p.seccion ?? "OTROS";
      const list = map.get(sec) ?? [];
      list.push(p);
      map.set(sec, list);
    }
    return map;
  }, [assignableParts]);

  function getPubName(id: string | null): string {
    if (!id) return "";
    return publishers.find((p) => p.id === id)?.nombre ?? "Desconocido";
  }

  function prayerName(tipo: "inicial" | "final"): string {
    const pr = prayers.find((p) => p.tipo === tipo);
    if (!pr?.publisher_id) return es["Sin asignar"];
    return getPubName(pr.publisher_id);
  }

  return (
    <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
      <Text style={{ fontSize: 20, fontWeight: "bold" }}>{es["Asignar"]}</Text>
      <Text>{es["Sala fija"]}: {es["Sala A"]}</Text>
      {offline ? <Text>{es["Necesitas conexión para asignar"]}</Text> : null}

      {/* ── 1. Reunião ── */}
      <Text style={{ fontWeight: "bold", fontSize: 16 }}>{es["Reunión"]}</Text>
      {meetings.length === 0 ? <Text>{es["Sin reuniones todavía"]}</Text> : null}
      {meetings.map((m) => (
        <Button
          key={m.id}
          title={`${m.semana_label ? `${m.semana_label} · ` : ""}${m.fecha} · ${m.tipo}`}
          onPress={() => {
            setMeetingId(m.id);
            setExpandedPart(null);
            setResult(null);
            setFormError(null);
            setPrayerSel({ inicial: null, final: null });
          }}
          color={m.id === meetingId ? "#0a7ea4" : undefined}
        />
      ))}

      {meeting ? (
        <View style={{ gap: 12 }}>
          {/* ── 2. Presidente ── */}
          {presPart ? (
            <PresidentSection
              part={presPart}
              publishers={available}
              publishersAll={publishers}
              congId={congId}
              offline={offline}
              getPubName={getPubName}
            />
          ) : (
            <View style={{ padding: 12, backgroundColor: "#eaf2f8", borderRadius: 8, borderWidth: 1, borderColor: "#aed6f1", gap: 6 }}>
              <Text style={{ fontWeight: "bold", fontSize: 15 }}>👤 {es["Presidente"]}</Text>
              <Text style={{ fontSize: 12, color: "#666" }}>
                Esta reunión no tiene parte de presidente para asignar.
              </Text>
            </View>
          )}

          {/* ── 3. Partes ── */}
          {[...grouped.entries()].map(([sec, parts]) => (
            <View key={sec} style={{ gap: 8 }}>
              <Text style={{ fontWeight: "bold", fontSize: 14, color: "#555", marginTop: 8 }}>
                {SECTION_LABELS[sec] ?? sec}
              </Text>
              {parts.map((p) => (
                <PartCard
                  key={p.id}
                  part={p}
                  publishers={available}
                  publishersAll={publishers}
                  congId={congId}
                  offline={offline}
                  getPubName={getPubName}
                  expanded={expandedPart === p.id}
                  onToggle={() => setExpandedPart(expandedPart === p.id ? null : p.id)}
                />
              ))}
            </View>
          ))}

          {/* ── 4. Oraciones ── */}
          <View style={{ gap: 8, marginTop: 8 }}>
            <Text style={{ fontWeight: "bold", fontSize: 14, color: "#555" }}>{es["Oración"]}</Text>
            {(["inicial", "final"] as const).map((tipo) => {
              const f = PART_FILTERS.wk_oracion ?? {};
              const eligible = available.filter((p) => matchesFilter(p, f));
              return (
                <View key={tipo} style={{ gap: 4, padding: 8, backgroundColor: "#f5f5f5", borderRadius: 6 }}>
                  <Text style={{ fontWeight: "600" }}>
                    {tipo === "final" ? es["Oración final"] : es["Oración inicial"]}: {prayerName(tipo)}
                  </Text>
                  <FlatList
                    data={eligible}
                    keyExtractor={(item) => `${tipo}-${item.id}`}
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    renderItem={({ item }) => (
                      <Button
                        title={item.nombre}
                        onPress={() => setPrayerSel((s) => ({ ...s, [tipo]: item.id }))}
                        color={prayerSel[tipo] === item.id ? "#1a5276" : "#ccc"}
                      />
                    )}
                  />
                  <Button
                    title={prayerMut.isPending ? es["Asignando..."] : es["Guardar oración"]}
                    onPress={() => prayerMut.mutate({ tipo, publisher_id: prayerSel[tipo] })}
                    disabled={prayerMut.isPending || offline || !prayerSel[tipo]}
                  />
                </View>
              );
            })}
            {prayerMsg ? <Text>{prayerMsg}</Text> : null}
          </View>

          {/* ── 5. Auto-asignar todas ── */}
          <View style={{ gap: 8, marginTop: 8, padding: 12, backgroundColor: "#eaf2f8", borderRadius: 8, borderWidth: 1, borderColor: "#aed6f1" }}>
            <Text style={{ fontWeight: "bold", fontSize: 14 }}>{es["Asignar todas"]}</Text>
            <Text style={{ fontSize: 12, color: "#666" }}>
              Asigna automáticamente las partes sin titular usando sugerencias del servidor.
            </Text>
            <Button
              title={autoAssignMut.isPending ? es["Asignando todas..."] : es["Asignar todas"]}
              onPress={() => autoAssignMut.mutate()}
              disabled={autoAssignMut.isPending || offline}
            />
            {autoAssignResult ? <Text style={{ fontSize: 12, color: "#27ae60" }}>{autoAssignResult}</Text> : null}
          </View>
        </View>
      ) : null}

      {formError ? <Text style={{ color: "red" }}>{formError}</Text> : null}
      {result ? (
        <View style={{ gap: 4 }}>
          <Text style={{ fontWeight: "bold" }}>{es["Asignación guardada"]}</Text>
          {result.warnings.length === 0 ? <Text>{es["Sin avisos"]}</Text> : null}
          {result.warnings.map((w, i) => (
            <Text key={`${w.tipo}-${i}`}>⚠ {w.mensaje_es}</Text>
          ))}
        </View>
      ) : null}
    </ScrollView>
  );
}

// ── Seção do Presidente ──

function PresidentSection({
  part,
  publishers,
  publishersAll,
  congId,
  offline,
  getPubName,
}: {
  part: { id: string; titulo: string; tipo_clave: string | null; titular_id: string | null };
  publishers: PublisherRef[];
  publishersAll: PublisherRef[];
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

function PartCard({
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
              {h ? ` · ${h.total} designaciones${h.last_fecha ? `, última: ${h.last_fecha}` : ""}` : ""}
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
