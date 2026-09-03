// Sources offered by the baseMap creation section (SectionCreateBaseMapFullscreen
// cards + drop zone). Per-scope activation lives in
// scopeConfigs.disabledBaseMapSourceKeys (Configuration > Fonds de plan).
// `fileBased` sources feed the drop zone (accepted extensions + formats line).
const BASE_MAP_SOURCE_CATALOG = [
  {
    key: "DWG",
    label: "Fichier DWG",
    caption: "Calques et échelle conservés",
    fileBased: true,
    extensions: [".dwg"],
    formats: ["DWG"],
  },
  {
    key: "PDF",
    label: "PDF",
    caption: "Choix de la page et cadrage",
    fileBased: true,
    extensions: [".pdf"],
    formats: ["PDF"],
  },
  {
    key: "IMAGE",
    label: "Image",
    caption: "JPG, PNG ou capture",
    fileBased: true,
    extensions: [".png", ".jpg", ".jpeg"],
    formats: ["JPG", "PNG"],
  },
  {
    key: "BLANK_PAGE",
    label: "Page blanche",
    caption: "Format à l'échelle",
  },
  {
    key: "SATELLITE",
    label: "Image satellite",
    caption: "Extrait géoréférencé",
  },
];

export default BASE_MAP_SOURCE_CATALOG;
