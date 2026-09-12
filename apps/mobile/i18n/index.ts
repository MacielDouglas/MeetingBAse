import i18n from "i18next";
import es from "./es.json";

const resources = { es: { translation: es } };

i18n.init({
  resources,
  lng: "es",
  fallbackLng: "es",
  supportedLngs: ["es"],
  interpolation: { escapeValue: false },
  compatibilityJSON: "v3",
});

export default i18n;
