import { useState, useEffect } from "react";
import { View, Text, TextInput, Switch, ScrollView, TouchableOpacity, Modal, Alert, ActivityIndicator } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { API_URL, authHeaders, getCongregationId, isNetworkError } from "../lib/api";
import es from "../i18n/es.json";

interface PublisherData {
  id?: string;
  nombre: string;
  apellido?: string;
  sexo?: string;
  activo?: boolean;
  apuntes?: string;
  celular?: string;
  telefono?: string;
  email?: string;
  cabezaFamilia?: boolean;
  ministroCampo?: string;
  siervo?: boolean;
  anciano?: boolean;
  oracion?: boolean;
  presidenteEntreSemana?: boolean;
  discursoEntreSemana?: boolean;
  busquemosPerlas?: boolean;
  lecturaBiblia?: boolean;
  empieceConversaciones?: boolean;
  hagaRevisitas?: boolean;
  hagaDiscipulos?: boolean;
  expliqueCreencias?: boolean;
  discursoEnsenanza?: boolean;
  ayudanteEnsenanza?: boolean;
  analisisAuditorio?: boolean;
  discursoAnalisis?: boolean;
  ebc?: boolean;
  lectorEbc?: boolean;
  sala?: string;
  presidenteFinSemana?: boolean;
  conductorAtalaya?: boolean;
  lectorAtalaya?: boolean;
  hospitalidad?: boolean;
  [key: string]: unknown;
}

const EMPTY: PublisherData = {
  nombre: "", apellido: "", sexo: "M", activo: true, apuntes: "",
  celular: "", telefono: "", email: "", cabezaFamilia: false,
  ministroCampo: "", siervo: false, anciano: false, oracion: false,
  presidenteEntreSemana: false, discursoEntreSemana: false, busquemosPerlas: false,
  lecturaBiblia: false, empieceConversaciones: false, hagaRevisitas: false,
  hagaDiscipulos: false, expliqueCreencias: false, discursoEnsenanza: false,
  ayudanteEnsenanza: false, analisisAuditorio: false, discursoAnalisis: false,
  ebc: false, lectorEbc: false, sala: "todas",
  presidenteFinSemana: false, conductorAtalaya: false, lectorAtalaya: false,
  hospitalidad: false,
};

const FIELD_BG = "#3a3a3c";
const CARD_BG = "#2c2c2e";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={{ marginBottom: 8 }}>
      <Text style={{ color: "#8e8e93", fontSize: 13, fontWeight: "600", marginLeft: 16, marginBottom: 6, marginTop: 12 }}>{title}</Text>
      <View style={{ backgroundColor: CARD_BG, borderRadius: 12, marginHorizontal: 12, overflow: "hidden" }}>{children}</View>
    </View>
  );
}

function FieldRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 0.5, borderBottomColor: "#3a3a3c" }}>
      <Text style={{ color: "#fff", fontSize: 15, flex: 1 }}>{label}</Text>
      <View style={{ alignItems: "flex-end", flex: 1 }}>{children}</View>
    </View>
  );
}

function TextInputField({ label, value, onChangeText, multiline, keyboardType }: { label: string; value: string; onChangeText: (t: string) => void; multiline?: boolean; keyboardType?: "default" | "phone-pad" | "email-address" }) {
  return (
    <View style={{ paddingHorizontal: 16, paddingVertical: 8, borderBottomWidth: 0.5, borderBottomColor: "#3a3a3c" }}>
      <Text style={{ color: "#8e8e93", fontSize: 12, marginBottom: 4 }}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        multiline={multiline}
        keyboardType={keyboardType}
        style={{ backgroundColor: FIELD_BG, borderRadius: 8, padding: 10, color: "#fff", fontSize: 15, minHeight: multiline ? 60 : 36 }}
        placeholderTextColor="#666"
      />
    </View>
  );
}

function ToggleRow({ label, value, onValueChange }: { label: string; value: boolean; onValueChange: (v: boolean) => void }) {
  return (
    <FieldRow label={label}>
      <Switch value={value} onValueChange={onValueChange} trackColor={{ false: "#555", true: "#4a90d9" }} thumbColor="#fff" />
    </FieldRow>
  );
}

function RadioRow({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity onPress={onPress} style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 0.5, borderBottomColor: "#3a3a3c" }}>
      <Text style={{ color: "#fff", fontSize: 15, flex: 1 }}>{label}</Text>
      <View style={{ width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: selected ? "#4a90d9" : "#666", alignItems: "center", justifyContent: "center" }}>
        {selected && <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: "#4a90d9" }} />}
      </View>
    </TouchableOpacity>
  );
}

function SelectorRow({ label, value, options, onSelect }: { label: string; value: string; options: string[]; onSelect: (v: string) => void }) {
  const [show, setShow] = useState(false);
  return (
    <View>
      <TouchableOpacity onPress={() => setShow(!show)} style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 0.5, borderBottomColor: "#3a3a3c" }}>
        <Text style={{ color: "#fff", fontSize: 15, flex: 1 }}>{label}</Text>
        <Text style={{ color: "#8e8e93", fontSize: 14, marginRight: 4 }}>{value || "—"}</Text>
        <Ionicons name={show ? "chevron-up" : "chevron-down"} size={16} color="#8e8e93" />
      </TouchableOpacity>
      {show && options.map((opt) => (
        <TouchableOpacity key={opt} onPress={() => { onSelect(opt); setShow(false); }} style={{ paddingHorizontal: 32, paddingVertical: 10, borderBottomWidth: 0.5, borderBottomColor: "#3a3a3c" }}>
          <Text style={{ color: opt === value ? "#4a90d9" : "#fff", fontSize: 14 }}>{opt}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

export function PublisherEdit({
  visible,
  onClose,
  publisher,
}: {
  visible: boolean;
  onClose: () => void;
  publisher?: PublisherData | null;
}) {
  const congId = getCongregationId();
  const client = useQueryClient();
  const [form, setForm] = useState<PublisherData>(EMPTY);
  const isEdit = !!publisher?.id;

  useEffect(() => {
    if (publisher) setForm({ ...EMPTY, ...publisher });
    else setForm(EMPTY);
  }, [publisher, visible]);

  const set = <K extends keyof PublisherData>(key: K, val: PublisherData[K]) => setForm((f) => ({ ...f, [key]: val }));

  const save = useMutation({
    mutationFn: async () => {
      const payload = { ...form };
      const url = isEdit ? `${API_URL}/c/${congId}/publishers/${form.id}` : `${API_URL}/c/${congId}/publishers`;
      const res = await fetch(url, {
        method: isEdit ? "PUT" : "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify(payload),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? es["Error al crear"]);
      return body.publisher;
    },
    onSuccess: () => {
      client.invalidateQueries({ queryKey: ["publishers", congId] });
      onClose();
    },
    onError: (e) => {
      const msg = isNetworkError(e) ? es["Sin conexión. Intente más tarde."] : (e as Error).message;
      Alert.alert(es["Error"], msg);
    },
  });

  function handleSave() {
    if (!form.nombre.trim()) {
      Alert.alert(es["Error"], es["Nombre requerido"]);
      return;
    }
    save.mutate();
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <View style={{ flex: 1, backgroundColor: "#1c1c1e" }}>
        {/* Header */}
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingTop: 56, paddingBottom: 12, backgroundColor: "#1a5276" }}>
          <TouchableOpacity onPress={onClose} style={{ padding: 8 }}>
            <Ionicons name="close-circle" size={28} color="#fff" />
          </TouchableOpacity>
          <Text style={{ color: "#fff", fontSize: 17, fontWeight: "600", flex: 1, textAlign: "center" }}>
            {isEdit ? `${form.nombre} ${form.apellido}` : "Nuevo publicador"}
          </Text>
          <TouchableOpacity onPress={handleSave} disabled={save.isPending} style={{ padding: 8 }}>
            {save.isPending ? <ActivityIndicator color="#fff" /> : <Ionicons name="checkmark" size={28} color="#fff" />}
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
          {/* Informaciones */}
          <Section title={es["Informaciones"]}>
            <TextInputField label={es["Nombre"]} value={form.nombre ?? ""} onChangeText={(v) => set("nombre", v)} />
            <TextInputField label={es["Apellido"]} value={form.apellido ?? ""} onChangeText={(v) => set("apellido", v)} />
            <RadioRow label={es["Hermano"]} selected={form.sexo === "M"} onPress={() => set("sexo", "M")} />
            <RadioRow label={es["Hermana"]} selected={form.sexo === "F"} onPress={() => set("sexo", "F")} />
            <ToggleRow label={es["Activo"]} value={form.activo ?? true} onValueChange={(v) => set("activo", v)} />
            <TextInputField label={es["Apuntes"]} value={form.apuntes ?? ""} onChangeText={(v) => set("apuntes", v)} multiline />
          </Section>

          {/* Datos de contacto */}
          <Section title={es["Datos de contacto"]}>
            <TextInputField label={es["Celular"]} value={form.celular ?? ""} onChangeText={(v) => set("celular", v)} keyboardType="phone-pad" />
            <TextInputField label={es["Teléfono"]} value={form.telefono ?? ""} onChangeText={(v) => set("telefono", v)} keyboardType="phone-pad" />
            <TextInputField label={es["Correo electrónico"]} value={form.email ?? ""} onChangeText={(v) => set("email", v)} keyboardType="email-address" />
          </Section>

          {/* Familia */}
          <Section title={es["Familia"]}>
            <ToggleRow label={es["Cabeza de familia"]} value={form.cabezaFamilia ?? false} onValueChange={(v) => set("cabezaFamilia", v)} />
          </Section>

          {/* Privilegios */}
          <Section title={es["Privilegios"]}>
            <SelectorRow label={es["Ministerio del campo"]} value={form.ministroCampo ?? ""} options={[es["Predicador"], es["Pionero auxiliar"], es["Pionero regular"], es["Especial"]]} onSelect={(v) => set("ministroCampo", v)} />
            <ToggleRow label={es["Siervo"]} value={form.siervo ?? false} onValueChange={(v) => set("siervo", v)} />
            <ToggleRow label={es["Anciano"]} value={form.anciano ?? false} onValueChange={(v) => set("anciano", v)} />
            <ToggleRow label={es["Oración"]} value={form.oracion ?? false} onValueChange={(v) => set("oracion", v)} />
          </Section>

          {/* Reunión de entre semana */}
          <Section title={es["Reunión de entre semana"]}>
            <ToggleRow label={es["Presidente"]} value={form.presidenteEntreSemana ?? false} onValueChange={(v) => set("presidenteEntreSemana", v)} />
            <ToggleRow label={es["Discurso"]} value={form.discursoEntreSemana ?? false} onValueChange={(v) => set("discursoEntreSemana", v)} />
            <ToggleRow label={es["Busquemos perlas escondidas"]} value={form.busquemosPerlas ?? false} onValueChange={(v) => set("busquemosPerlas", v)} />
            <ToggleRow label={es["Lectura de la Biblia"]} value={form.lecturaBiblia ?? false} onValueChange={(v) => set("lecturaBiblia", v)} />
          </Section>

          {/* Enseñanzas */}
          <Section title={es["Enseñanzas"]}>
            <ToggleRow label={es["Empiece conversaciones"]} value={form.empieceConversaciones ?? false} onValueChange={(v) => set("empieceConversaciones", v)} />
            <ToggleRow label={es["Haga revisitás"]} value={form.hagaRevisitas ?? false} onValueChange={(v) => set("hagaRevisitas", v)} />
            <ToggleRow label={es["Haga discípulos"]} value={form.hagaDiscipulos ?? false} onValueChange={(v) => set("hagaDiscipulos", v)} />
            <ToggleRow label={es["Explique sus creencias"]} value={form.expliqueCreencias ?? false} onValueChange={(v) => set("expliqueCreencias", v)} />
            <ToggleRow label={es["Discurso"]} value={form.discursoEnsenanza ?? false} onValueChange={(v) => set("discursoEnsenanza", v)} />
            <ToggleRow label={es["Ayudante"]} value={form.ayudanteEnsenanza ?? false} onValueChange={(v) => set("ayudanteEnsenanza", v)} />
            <ToggleRow label={es["Análisis con el auditorio"]} value={form.analisisAuditorio ?? false} onValueChange={(v) => set("analisisAuditorio", v)} />
          </Section>

          {/* Más permisos entre semana */}
          <Section title="">
            <ToggleRow label={es["Discurso o análisis con el auditorio"]} value={form.discursoAnalisis ?? false} onValueChange={(v) => set("discursoAnalisis", v)} />
            <ToggleRow label={es["Estudio Bíblico de Congregación"]} value={form.ebc ?? false} onValueChange={(v) => set("ebc", v)} />
            <ToggleRow label={es["Lector Est. bíblico de la cong."]} value={form.lectorEbc ?? false} onValueChange={(v) => set("lectorEbc", v)} />
          </Section>

          {/* Sala */}
          <Section title={es["Sala"]}>
            <RadioRow label={es["Todas las salas"]} selected={(form.sala ?? "todas") === "todas"} onPress={() => set("sala", "todas")} />
            <RadioRow label={es["Únicamente sala principal"]} selected={form.sala === "principal"} onPress={() => set("sala", "principal")} />
            <RadioRow label={es["Únicamente sala auxiliar"]} selected={form.sala === "auxiliar"} onPress={() => set("sala", "auxiliar")} />
          </Section>

          {/* Reunión del fin de semana */}
          <Section title={es["Reunión del fin de semana"]}>
            <ToggleRow label={es["Presidente"]} value={form.presidenteFinSemana ?? false} onValueChange={(v) => set("presidenteFinSemana", v)} />
            <ToggleRow label={es["Conductor del estudio de La Atalaya"]} value={form.conductorAtalaya ?? false} onValueChange={(v) => set("conductorAtalaya", v)} />
            <ToggleRow label={es["Lector del estudio de La Atalaya"]} value={form.lectorAtalaya ?? false} onValueChange={(v) => set("lectorAtalaya", v)} />
            <ToggleRow label={es["Hospitalidad"]} value={form.hospitalidad ?? false} onValueChange={(v) => set("hospitalidad", v)} />
          </Section>
        </ScrollView>
      </View>
    </Modal>
  );
}
