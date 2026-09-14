import { useState } from "react";
import { Switch, Text, View } from "react-native";
import es from "../i18n/es.json";

export interface PublisherPrivileges {
  cabezaFamilia: boolean;
  presidenteSemana: boolean;
  tesourosDiscurso: boolean;
  tesourosJoias: boolean;
  tesourosLeitura: boolean;
  ministerioIniciar: boolean;
  ministerioCultivar: boolean;
  ministerioDiscipulos: boolean;
  ministerioExplicar: boolean;
  ministerioAjudante: boolean;
  ministerioDiscurso: boolean;
  ministerioOque: boolean;
  vidaDiscurso: boolean;
  vidaCondutor: boolean;
  vidaLeitor: boolean;
  oracao: boolean;
  pubPresidente: boolean;
  pubDiscurso: boolean;
  pubSentinelaCondutor: boolean;
  pubSentinelaLeitor: boolean;
}

export const DEFAULT_PRIVILEGES: PublisherPrivileges = {
  cabezaFamilia: false,
  presidenteSemana: false,
  tesourosDiscurso: false,
  tesourosJoias: false,
  tesourosLeitura: false,
  ministerioIniciar: true,
  ministerioCultivar: true,
  ministerioDiscipulos: true,
  ministerioExplicar: true,
  ministerioAjudante: true,
  ministerioDiscurso: true,
  ministerioOque: false,
  vidaDiscurso: false,
  vidaCondutor: false,
  vidaLeitor: false,
  oracao: false,
  pubPresidente: false,
  pubDiscurso: false,
  pubSentinelaCondutor: false,
  pubSentinelaLeitor: false,
};

interface PrivilegeToggleProps {
  label: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
  disabled?: boolean;
}

function PrivilegeToggle({ label, value, onValueChange, disabled }: PrivilegeToggleProps) {
  return (
    <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 6 }}>
      <Text style={{ flex: 1, fontSize: 14, color: disabled ? "#999" : "#333" }}>{label}</Text>
      <Switch
        value={value}
        onValueChange={onValueChange}
        disabled={disabled}
        trackColor={{ false: "#ccc", true: "#81b0ff" }}
        thumbColor={value ? "#1a5276" : "#f4f3f4"}
      />
    </View>
  );
}

interface PrivilegesFormProps {
  sexo: "M" | "F";
  cargo: string;
  privileges: PublisherPrivileges;
  onPrivilegesChange: (privileges: PublisherPrivileges) => void;
}

const MALE_ONLY_FIELDS: (keyof PublisherPrivileges)[] = [
  "presidenteSemana",
  "tesourosDiscurso",
  "tesourosJoias",
  "tesourosLeitura",
  "ministerioDiscurso",
  "ministerioOque",
  "vidaDiscurso",
  "vidaCondutor",
  "vidaLeitor",
  "oracao",
  "pubPresidente",
  "pubDiscurso",
  "pubSentinelaCondutor",
  "pubSentinelaLeitor",
];

const ELDER_OR_SERVANT_FIELDS: (keyof PublisherPrivileges)[] = [
  "presidenteSemana",
  "tesourosDiscurso",
  "tesourosJoias",
  "ministerioOque",
  "vidaDiscurso",
  "vidaCondutor",
  "pubPresidente",
  "pubDiscurso",
  "pubSentinelaCondutor",
];

export function PrivilegesForm({ sexo, cargo, privileges, onPrivilegesChange }: PrivilegesFormProps) {
  const isMale = sexo === "M";
  const isElderOrServant = cargo === "anciano" || cargo === "siervo_ministerial";

  function isDisabled(field: keyof PublisherPrivileges): boolean {
    if (MALE_ONLY_FIELDS.includes(field) && !isMale) return true;
    if (ELDER_OR_SERVANT_FIELDS.includes(field) && !isElderOrServant) return true;
    return false;
  }

  function handleChange(field: keyof PublisherPrivileges, value: boolean) {
    onPrivilegesChange({ ...privileges, [field]: value });
  }

  return (
    <View style={{ gap: 16 }}>
      <View>
        <Text style={{ fontSize: 16, fontWeight: "bold", marginBottom: 8 }}>{es["Reunión entre semana"]}</Text>
        <PrivilegeToggle
          label={es["Presidente"]}
          value={privileges.presidenteSemana}
          onValueChange={(v) => handleChange("presidenteSemana", v)}
          disabled={isDisabled("presidenteSemana")}
        />
        <Text style={{ fontSize: 12, color: "#888", marginBottom: 4 }}>{es["Sección: Tesoros de la Palabra de Dios"]}</Text>
        <PrivilegeToggle
          label={es["Discurso"]}
          value={privileges.tesourosDiscurso}
          onValueChange={(v) => handleChange("tesourosDiscurso", v)}
          disabled={isDisabled("tesourosDiscurso")}
        />
        <PrivilegeToggle
          label={es["Joyas espirituales"]}
          value={privileges.tesourosJoias}
          onValueChange={(v) => handleChange("tesourosJoias", v)}
          disabled={isDisabled("tesourosJoias")}
        />
        <PrivilegeToggle
          label={es["Lectura de la Biblia"]}
          value={privileges.tesourosLeitura}
          onValueChange={(v) => handleChange("tesourosLeitura", v)}
          disabled={isDisabled("tesourosLeitura")}
        />
        <Text style={{ fontSize: 12, color: "#888", marginBottom: 4, marginTop: 8 }}>{es["Sección: Haz tu mejor ministerio"]}</Text>
        <PrivilegeToggle
          label={es["Iniciar conversaciones"]}
          value={privileges.ministerioIniciar}
          onValueChange={(v) => handleChange("ministerioIniciar", v)}
        />
        <PrivilegeToggle
          label={es["Cultivar el interés"]}
          value={privileges.ministerioCultivar}
          onValueChange={(v) => handleChange("ministerioCultivar", v)}
        />
        <PrivilegeToggle
          label={es["Hacer discípulos"]}
          value={privileges.ministerioDiscipulos}
          onValueChange={(v) => handleChange("ministerioDiscipulos", v)}
        />
        <PrivilegeToggle
          label={es["Explicar las creencias"]}
          value={privileges.ministerioExplicar}
          onValueChange={(v) => handleChange("ministerioExplicar", v)}
        />
        <PrivilegeToggle
          label={es["Ayudante"]}
          value={privileges.ministerioAjudante}
          onValueChange={(v) => handleChange("ministerioAjudante", v)}
        />
        <PrivilegeToggle
          label={es["Discurso"]}
          value={privileges.ministerioDiscurso}
          onValueChange={(v) => handleChange("ministerioDiscurso", v)}
          disabled={isDisabled("ministerioDiscurso")}
        />
        <PrivilegeToggle
          label={es["¿Qué dirías?"]}
          value={privileges.ministerioOque}
          onValueChange={(v) => handleChange("ministerioOque", v)}
          disabled={isDisabled("ministerioOque")}
        />
        <Text style={{ fontSize: 12, color: "#888", marginBottom: 4, marginTop: 8 }}>{es["Sección: Nuestra vida cristiana"]}</Text>
        <PrivilegeToggle
          label={es["Discurso"]}
          value={privileges.vidaDiscurso}
          onValueChange={(v) => handleChange("vidaDiscurso", v)}
          disabled={isDisabled("vidaDiscurso")}
        />
        <PrivilegeToggle
          label={es["Conductor del estudio bíblico"]}
          value={privileges.vidaCondutor}
          onValueChange={(v) => handleChange("vidaCondutor", v)}
          disabled={isDisabled("vidaCondutor")}
        />
        <PrivilegeToggle
          label={es["Lector del estudio bíblico"]}
          value={privileges.vidaLeitor}
          onValueChange={(v) => handleChange("vidaLeitor", v)}
          disabled={isDisabled("vidaLeitor")}
        />
        <PrivilegeToggle
          label={es["Oración"]}
          value={privileges.oracao}
          onValueChange={(v) => handleChange("oracao", v)}
          disabled={isDisabled("oracao")}
        />
      </View>

      <View>
        <Text style={{ fontSize: 16, fontWeight: "bold", marginBottom: 8 }}>{es["Reunión pública"]}</Text>
        <PrivilegeToggle
          label={es["Presidente de la reunión pública"]}
          value={privileges.pubPresidente}
          onValueChange={(v) => handleChange("pubPresidente", v)}
          disabled={isDisabled("pubPresidente")}
        />
        <PrivilegeToggle
          label={es["Discurso público"]}
          value={privileges.pubDiscurso}
          onValueChange={(v) => handleChange("pubDiscurso", v)}
          disabled={isDisabled("pubDiscurso")}
        />
        <PrivilegeToggle
          label={es["Conductor del estudio de la Atalaya"]}
          value={privileges.pubSentinelaCondutor}
          onValueChange={(v) => handleChange("pubSentinelaCondutor", v)}
          disabled={isDisabled("pubSentinelaCondutor")}
        />
        <PrivilegeToggle
          label={es["Lector del estudio de la Atalaya"]}
          value={privileges.pubSentinelaLeitor}
          onValueChange={(v) => handleChange("pubSentinelaLeitor", v)}
          disabled={isDisabled("pubSentinelaLeitor")}
        />
      </View>
    </View>
  );
}
