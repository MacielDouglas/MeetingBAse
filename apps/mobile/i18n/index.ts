import i18n from "i18next";
import es from "./es.json";

const resources = { es: { translation: es } };

i18n.init({
  resources,
  lng: "es",
  fallbackLng: "es",
  interpolation: { escapeValue: false },
});

export default i18n;
