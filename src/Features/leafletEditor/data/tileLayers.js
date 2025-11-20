import L from "leaflet";

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
    crossOrigin: true,
  }
);

// OpenStreetMap tiles with explicit CORS headers to allow canvas export
export const OpenStreetMapCors = L.tileLayer(
  "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
  {
    maxZoom: 19,
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    crossOrigin: "anonymous",
    detectRetina: true,
  }
);

export const EsriWorldImagery = L.tileLayer(
  "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
  {
    maxZoom: 19,
    attribution: "Tiles © Esri & partners",
    crossOrigin: "anonymous",
    detectRetina: true,
  }
);
