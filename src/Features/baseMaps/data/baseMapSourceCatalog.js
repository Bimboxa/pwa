// Sources offered by the baseMap creation section (SectionCreateBaseMapFullscreen
// cards + drop zone). Per-scope activation lives in
// scopeConfigs.disabledBaseMapSourceKeys (Configuration > Fonds de plan).
// `fileBased` sources feed the drop zone (accepted extensions + formats line).
const BASE_MAP_SOURCE_CATALOG = [
  {
    key: "DXF",
    label: "Fichier DXF",
    caption: "Calques et annotations 2D",
    fileBased: true,
    extensions: [".dxf"],
    formats: ["DXF"],
  },
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
  // Empty orthomosaic (baseMap.isOrthophoto): the photos are added from the
  // Orthophotos tool, see docs/baseMaps/ORTHOPHOTOS.md.
  {
    key: "ORTHOPHOTO",
    label: "Orthophoto",
    caption: "Assemblage de photos vues de dessus",
  },
  // Empty 3D reconstruction (baseMap.isReconstruction3d): the photos or the
  // video are added from the Reconstruction 3D tool, see
  // docs/baseMaps/RECONSTRUCTION_3D.md.
  {
    key: "RECONSTRUCTION_3D",
    label: "Reconstruction 3D",
    caption: "Modèle 3D à partir de photos ou d'une vidéo",
  },
  {
    key: "SATELLITE",
    label: "Image satellite",
    caption: "Extrait géoréférencé",
  },
  {
    key: "SCENE_3D",
    label: "Scène 3D",
    caption: "Maillage ou nuage de points (PLY)",
  },
];

export default BASE_MAP_SOURCE_CATALOG;
