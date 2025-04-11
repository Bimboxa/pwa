// Plan IGN avec une transparence de 50%
export const PlanIGN = L.tileLayer(
  "https://data.geopf.fr/wmts?" +
    "&REQUEST=GetTile&SERVICE=WMTS&VERSION=1.0.0&TILEMATRIXSET=PM" +
    "&LAYER={ignLayer}&STYLE={style}&FORMAT={format}" +
    "&TILECOL={x}&TILEROW={y}&TILEMATRIX={z}",
  {
    ignLayer: "GEOGRAPHICALGRIDSYSTEMS.PLANIGNV2",
    style: "normal",
    format: "image/png",
    service: "WMTS",
    opacity: 0.4,
    attribution: "Carte © IGN/Geoplateforme",
  }
);

// Photographies aériennes en-dessous de Plan IGN
export const OrthoIGN = L.tileLayer(
  "https://data.geopf.fr/wmts?" +
    "&REQUEST=GetTile&SERVICE=WMTS&VERSION=1.0.0&TILEMATRIXSET=PM" +
    "&LAYER={ignLayer}&STYLE={style}&FORMAT={format}" +
    "&TILECOL={x}&TILEROW={y}&TILEMATRIX={z}",
  {
    ignLayer: "ORTHOIMAGERY.ORTHOPHOTOS",
    style: "normal",
    format: "image/jpeg",
    service: "WMTS",
  }
);
