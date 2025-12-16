import {
  red,
  green,
  blue,
  deepPurple,
  purple,
  orange,
} from "@mui/material/colors";
import theme from "Styles/theme";

import chariotImageUrl from "App/assets/lib - chariot - 1cm.png";

const annotationTemplatesLibrary = [
  // STANDARD
  {
    isGroup: true,
    label: "Standard",
    group: "Standard",
  },
  {
    type: "POLYGON",
    label: "Surface",
    group: "Standard",
    fillColor: orange[500],
    fillOpacity: 0.8,
    strokeColor: orange[800],
    closeLine: true,
  },
  // {
  //   type: "POLYLINE",
  //   label: "Ouverture",
  //   group: "Standard",
  //   fillColor: blue[500],
  //   fillOpacity: 0.1,
  //   strokeColor: blue[800],
  //   closeLine: true,
  //   cutHost: true,
  // },
  {
    type: "POLYLINE",
    label: "Ligne",
    group: "Standard",
    strokeColor: purple[800],
    strokeWidth: 4,
    strokeWidthUnit: "PX",
    closeLine: false,
  },
  {
    type: "TEXT",
    label: "Texte",
    group: "Standard",
    fillColor: theme.palette.background.default,
  },

  // RECEPTION DE SUPPORTS
  {
    isGroup: true,
    label: "Réception de support",
    group: "Réception de support",
  },
  {
    type: "MARKER",
    iconKey: "ring",
    fillColor: red[500],
    label: "Traversée NC",
    group: "Réception de support",
  },
  {
    type: "MARKER",
    iconKey: "square",
    fillColor: green[500],
    label: "Réservation NC",
    group: "Réception de support",
  },
  {
    type: "MARKER",
    iconKey: "drop",
    fillColor: blue[500],
    label: "Présence d'eau stagnante",
    group: "Réception de support",
  },
  {
    type: "MARKER",
    iconKey: "triangle",
    fillColor: deepPurple[500],
    label: "Support à poncer",
    group: "Réception de support",
  },
  {
    type: "MARKER",
    iconKey: "triangle",
    fillColor: purple[500],
    label: "Fissure",
    group: "Réception de support",
  },

  //

  {
    isGroup: true,
    label: "PIC",
    group: "PIC",
  },

  // PIC

  {
    type: "POLYLINE",
    label: "Barrière HERAS",
    group: "PIC",
    strokeColor: orange[500],
  },
  {
    type: "IMAGE",
    label: "Charriot",
    group: "PIC",
    image: { imageUrlClient: chariotImageUrl, isImage: true },
    meterByPx: 0.01,
  },
  {
    type: "RECTANGLE",
    label: "Benne de chantier",
    group: "PIC",
    fillColor: blue[500],
  },
  {
    type: "RECTANGLE",
    label: "WC de chantier",
    group: "PIC",
    fillColor: blue[800],
  },
  {
    type: "RECTANGLE",
    label: "Roulotte de chantier",
    group: "PIC",
    fillColor: purple[500],
  },

  // Observations
  {
    isGroup: true,
    label: "Contrôles",
    group: "CONTROL",
  },
  {
    type: "MARKER",
    iconKey: "triangle",
    fillColor: purple[500],
    label: "Sondage",
    group: "CONTROL",
  },
  {
    type: "MARKER",
    iconKey: "triangle",
    fillColor: blue[500],
    label: "Prélèvement",
    group: "CONTROL",
  },
];

export default annotationTemplatesLibrary;
