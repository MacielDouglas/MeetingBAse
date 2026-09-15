import { View, Text } from "react-native";
import { Ionicons, MaterialCommunityIcons, FontAwesome6 } from "@expo/vector-icons";
import { fmtTime } from "../lib/formatDate";
import es from "../i18n/es.json";
import type { ProgramaMeeting, ProgramaPart } from "../lib/dbPrograma";

function addMinutes(time: string, minutes: number): string {
  const [h, m] = time.split(":").map(Number);
  const total = h * 60 + m + minutes;
  const nh = Math.floor(total / 60);
  const nm = total % 60;
  return `${String(nh).padStart(2, "0")}:${String(nm).padStart(2, "0")}`;
}

// ── Cores das seções ──
const TESOROS_COLOR = "#3c7f8b";
const MAESTROS_COLOR = "#d68f00";
const VIDA_COLOR = "#bf2f13";

type Item =
  | { kind: "presidente"; name: string }
  | { kind: "song_initial"; number: string; title: string; hasPrayer: boolean; prayerName: string | null; duracion: number }
  | { kind: "intro"; duracion: number }
  | { kind: "section_header"; label: string; bg: string; iconLib: "ion" | "mci" | "fa6"; iconName: string; color: string }
  | { kind: "part"; p: ProgramaPart; timeBg: string; timeColor: string; duracionExtra: number }
  | { kind: "section_song"; number: string; title: string; timeBg: string; timeColor: string; duracion: number }
  | { kind: "conclusion"; duracion: number }
  | { kind: "song_final"; number: string; title: string; hasPrayer: boolean; prayerName: string | null; duracion: number };

export function MidweekMeeting({
  meeting,
  pubName,
  startTime,
}: {
  meeting: ProgramaMeeting;
  pubName: (id: string | null) => string;
  startTime: string;
}) {
  const presidente = meeting.parts.find((p) => p.seccion === "PRESIDENTE");
  const cancionInicial = meeting.parts.find((p) => p.tipo_clave === "cancion_inicial");
  const introPart = meeting.parts.find((p) => p.tipo_clave === "mwb_tgw_intro");
  const tesoros = meeting.parts.filter((p) => p.seccion === "TESOROS");
  const maestros = meeting.parts.filter((p) => p.seccion === "MAESTROS");
  const cancionIntermedia = meeting.parts.find((p) => p.tipo_clave === "cancion_intermedia");
  const vida = meeting.parts.filter((p) => p.seccion === "VIDA");
  const ebc = meeting.parts.filter((p) => p.seccion === "EBC");
  const conclusionPart = meeting.parts.find((p) => p.tipo_clave === "mwb_conclusion");
  const cancionFinal = meeting.parts.find((p) => p.tipo_clave === "cancion_final");
  const oracionInicial = meeting.prayers.find((p) => p.tipo === "inicial");
  const oracionFinal = meeting.prayers.find((p) => p.tipo === "final");

  const items: { item: Item; time: string }[] = [];
  let t = startTime;

  items.push({ item: { kind: "presidente", name: presidente?.titular_id ? pubName(presidente.titular_id) : es["Sin asignar"] }, time: "" });

  const songInitDur = cancionInicial?.duracion_min ?? 5;
  items.push({
    item: { kind: "song_initial", number: cancionInicial?.titulo?.replace("Canción ", "") ?? "", title: cancionInicial?.titulo ?? "", hasPrayer: !!oracionInicial, prayerName: oracionInicial?.publisher_id ? pubName(oracionInicial.publisher_id) : null, duracion: songInitDur },
    time: t,
  });
  t = addMinutes(t, songInitDur);

  const introDur = introPart?.duracion_min ?? 1;
  items.push({ item: { kind: "intro", duracion: introDur }, time: t });
  t = addMinutes(t, introDur);

  // TESOROS DE LA BIBLIA
  if (tesoros.length > 0) {
    items.push({ item: { kind: "section_header", label: "TESOROS DE LA BIBLIA", bg: TESOROS_COLOR, iconLib: "ion", iconName: "diamond-sharp", color: TESOROS_COLOR }, time: "" });
    for (const p of tesoros) {
      const dur = p.duracion_min ?? 10;
      items.push({ item: { kind: "part", p, timeBg: TESOROS_COLOR, timeColor: "#fff", duracionExtra: 0 }, time: t });
      t = addMinutes(t, dur);
      if (p.titulo.includes("Lectura de la Biblia")) {
        t = addMinutes(t, 2);
      }
    }
  }

  // SEAMOS MEJORES MAESTROS
  if (maestros.length > 0) {
    items.push({ item: { kind: "section_header", label: "SEAMOS MEJORES MAESTROS", bg: MAESTROS_COLOR, iconLib: "fa6", iconName: "wheat-awn", color: MAESTROS_COLOR }, time: "" });
    for (const p of maestros) {
      const dur = p.duracion_min ?? 10;
      items.push({ item: { kind: "part", p, timeBg: MAESTROS_COLOR, timeColor: "#fff", duracionExtra: 1 }, time: t });
      t = addMinutes(t, dur + 1);
    }
  }

  // NUESTRA VIDA CRISTIANA
  items.push({ item: { kind: "section_header", label: "NUESTRA VIDA CRISTIANA", bg: VIDA_COLOR, iconLib: "mci", iconName: "sheep", color: VIDA_COLOR }, time: "" });

  const songInterDur = cancionIntermedia?.duracion_min ?? 5;
  items.push({
    item: { kind: "section_song", number: cancionIntermedia?.titulo?.replace("Canción ", "") ?? "", title: cancionIntermedia?.titulo ?? "", timeBg: VIDA_COLOR, timeColor: "#fff", duracion: songInterDur },
    time: t,
  });
  t = addMinutes(t, songInterDur);

  for (const p of vida) {
    const dur = p.duracion_min ?? 10;
    items.push({ item: { kind: "part", p, timeBg: VIDA_COLOR, timeColor: "#fff", duracionExtra: 0 }, time: t });
    t = addMinutes(t, dur);
  }

  for (const p of ebc) {
    const dur = p.duracion_min ?? 15;
    items.push({ item: { kind: "part", p, timeBg: VIDA_COLOR, timeColor: "#fff", duracionExtra: 0 }, time: t });
    t = addMinutes(t, dur);
  }

  const conclusionDur = conclusionPart?.duracion_min ?? 3;
  items.push({ item: { kind: "conclusion", duracion: conclusionDur }, time: t });
  t = addMinutes(t, conclusionDur);

  const songFinalDur = cancionFinal?.duracion_min ?? 5;
  items.push({
    item: { kind: "song_final", number: cancionFinal?.titulo?.replace("Canción ", "") ?? "", title: cancionFinal?.titulo ?? "", hasPrayer: !!oracionFinal, prayerName: oracionFinal?.publisher_id ? pubName(oracionFinal.publisher_id) : null, duracion: songFinalDur },
    time: t,
  });

  return (
    <View>
      {items.map(({ item, time }) => {
        switch (item.kind) {
          case "presidente":
            return (
              <View key="presidente" style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 12, paddingHorizontal: 14, backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: "#e0e0e0" }}>
                <Text style={{ fontSize: 15, color: "#333" }}>Presidente</Text>
                <Text style={{ fontSize: 14, color: "#555" }}>{item.name}</Text>
              </View>
            );
          case "song_initial":
            return (
              <View key="song_initial" style={{ flexDirection: "row", paddingVertical: 8, paddingHorizontal: 14, borderBottomWidth: 0.5, borderBottomColor: "#eee" }}>
                <View style={{ backgroundColor: "#e8f0fe", borderRadius: 4, paddingHorizontal: 6, paddingVertical: 3, minWidth: 44, alignItems: "center", marginRight: 12, alignSelf: "flex-start", marginTop: 2 }}>
                  <Text style={{ fontSize: 12, fontWeight: "bold", color: "#1a73e8" }}>{fmtTime(time)}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 14, color: "#333" }}>Canción {item.number}{item.hasPrayer ? " y oración" : ""}</Text>
                  <Text style={{ fontSize: 12, color: "#888" }}>{item.title}</Text>
                  <Text style={{ fontSize: 11, color: "#bbb", marginTop: 2 }}>({item.duracion}min)</Text>
                </View>
                {item.prayerName ? <View style={{ alignItems: "flex-end", marginLeft: 8, alignSelf: "center" }}><Text style={{ fontSize: 13, color: "#555" }}>{item.prayerName}</Text></View> : null}
              </View>
            );
          case "intro":
            return (
              <View key="intro" style={{ flexDirection: "row", paddingVertical: 8, paddingHorizontal: 14, borderBottomWidth: 0.5, borderBottomColor: "#eee" }}>
                <View style={{ backgroundColor: "#e8f0fe", borderRadius: 4, paddingHorizontal: 6, paddingVertical: 3, minWidth: 44, alignItems: "center", marginRight: 12, alignSelf: "flex-start", marginTop: 2 }}>
                  <Text style={{ fontSize: 12, fontWeight: "bold", color: "#1a73e8" }}>{fmtTime(time)}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 14, color: "#333" }}>Palabras de introducción</Text>
                  <Text style={{ fontSize: 11, color: "#bbb", marginTop: 2 }}>({item.duracion}min)</Text>
                </View>
              </View>
            );
          case "section_header":
            return (
              <View key={`sec_${item.label}`} style={{ marginTop: 8 }}>
                <View style={{ backgroundColor: item.bg + "22", paddingVertical: 10, paddingHorizontal: 14, borderRadius: 8, flexDirection: "row", alignItems: "center", gap: 10 }}>
                  <View style={{ backgroundColor: item.color, borderRadius: 6, width: 32, height: 32, alignItems: "center", justifyContent: "center" }}>
                    {item.iconLib === "ion" ? (
                      <Ionicons name={item.iconName as keyof typeof Ionicons.glyphMap} size={18} color="#fff" />
                    ) : item.iconLib === "mci" ? (
                      <MaterialCommunityIcons name={item.iconName as keyof typeof MaterialCommunityIcons.glyphMap} size={20} color="#fff" />
                    ) : (
                      <FontAwesome6 name={item.iconName} size={16} color="#fff" solid />
                    )}
                  </View>
                  <Text style={{ fontSize: 14, fontWeight: "bold", color: item.color, letterSpacing: 0.5 }}>{item.label}</Text>
                </View>
              </View>
            );
          case "part":
            return (
              <View key={item.p.id} style={{ flexDirection: "row", paddingVertical: 8, paddingHorizontal: 14, borderBottomWidth: 0.5, borderBottomColor: "#eee" }}>
                <View style={{ backgroundColor: item.timeBg, borderRadius: 4, paddingHorizontal: 6, paddingVertical: 3, minWidth: 44, alignItems: "center", marginRight: 12, alignSelf: "flex-start", marginTop: 2 }}>
                  <Text style={{ fontSize: 12, fontWeight: "bold", color: item.timeColor }}>{fmtTime(time)}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 14, color: "#333", fontWeight: "500" }}>{item.p.titulo}</Text>
                  <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end" }}>
                    <Text style={{ fontSize: 11, color: "#bbb", marginTop: 2 }}>({item.p.duracion_min ?? "?"}min)</Text>
                    {item.p.titular_id ? (
                      <View style={{ alignItems: "flex-end" }}>
                        <Text style={{ fontSize: 13, color: "#555" }}>{pubName(item.p.titular_id)}</Text>
                        {item.p.ayudante_id ? <Text style={{ fontSize: 12, color: "#888" }}>{pubName(item.p.ayudante_id)}</Text> : null}
                      </View>
                    ) : null}
                  </View>
                </View>
              </View>
            );
          case "section_song":
            return (
              <View key="section_song" style={{ flexDirection: "row", paddingVertical: 8, paddingHorizontal: 14, borderBottomWidth: 0.5, borderBottomColor: "#eee" }}>
                <View style={{ backgroundColor: item.timeBg, borderRadius: 4, paddingHorizontal: 6, paddingVertical: 3, minWidth: 44, alignItems: "center", marginRight: 12, alignSelf: "flex-start", marginTop: 2 }}>
                  <Text style={{ fontSize: 12, fontWeight: "bold", color: item.timeColor }}>{fmtTime(time)}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 14, color: "#333" }}>Canción {item.number}</Text>
                  <Text style={{ fontSize: 12, color: "#888" }}>{item.title}</Text>
                  <Text style={{ fontSize: 11, color: "#bbb", marginTop: 2 }}>({item.duracion}min)</Text>
                </View>
              </View>
            );
          case "conclusion":
            return (
              <View key="conclusion" style={{ flexDirection: "row", paddingVertical: 8, paddingHorizontal: 14, borderBottomWidth: 0.5, borderBottomColor: "#eee", marginTop: 8 }}>
                <View style={{ backgroundColor: "#e8f0fe", borderRadius: 4, paddingHorizontal: 6, paddingVertical: 3, minWidth: 44, alignItems: "center", marginRight: 12, alignSelf: "flex-start", marginTop: 2 }}>
                  <Text style={{ fontSize: 12, fontWeight: "bold", color: "#1a73e8" }}>{fmtTime(time)}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 14, color: "#333" }}>Palabras de conclusión</Text>
                  <Text style={{ fontSize: 11, color: "#bbb", marginTop: 2 }}>({item.duracion}min)</Text>
                </View>
              </View>
            );
          case "song_final":
            return (
              <View key="song_final" style={{ flexDirection: "row", paddingVertical: 8, paddingHorizontal: 14, borderBottomWidth: 0.5, borderBottomColor: "#eee" }}>
                <View style={{ backgroundColor: "#e8f0fe", borderRadius: 4, paddingHorizontal: 6, paddingVertical: 3, minWidth: 44, alignItems: "center", marginRight: 12, alignSelf: "flex-start", marginTop: 2 }}>
                  <Text style={{ fontSize: 12, fontWeight: "bold", color: "#1a73e8" }}>{fmtTime(time)}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 14, color: "#333" }}>Canción {item.number}{item.hasPrayer ? " y oración" : ""}</Text>
                  <Text style={{ fontSize: 12, color: "#888" }}>{item.title}</Text>
                  <Text style={{ fontSize: 11, color: "#bbb", marginTop: 2 }}>({item.duracion}min)</Text>
                </View>
                {item.prayerName ? <View style={{ alignItems: "flex-end", marginLeft: 8, alignSelf: "center" }}><Text style={{ fontSize: 13, color: "#555" }}>{item.prayerName}</Text></View> : null}
              </View>
            );
          default:
            return null;
        }
      })}
    </View>
  );
}
