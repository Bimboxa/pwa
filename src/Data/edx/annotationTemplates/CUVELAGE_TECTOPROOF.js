import { brown, orange, purple, red } from "@mui/material/colors"

const CUVELAGE_TECTOPROOF = {
    key: "CUVELAGE_TECTOPROOF",
    name: "Cuvelage - Tectoproof CA-N",
    iconKey: "shapes",
    color: orange[500],
    keywords: ["type:repérage", "secteur:cuvelage", "système:tectoproof"],
    articlesNomenclaturesKeys: ["CUVELAGE"],
    templates: [
        {
            label: "VCT [ht 3.17 m]",
            labelLegend: "Tectoproof CA-N en VCT sur 3,17m",
            height: 3.17,
            drawingShape: "POLYLINE",
            strokeColor: "#FF644E",
            strokeOpacity: 0.8,
            strokeWidth: 4,
            strokeWidthUnit: "PX",
            mainQtyKey: "S",
        },
        {
            label: "Voiles [ht 1.00 m]",
            labelLegend: "Tectoproof CA-N en voiles sur 1,00m",
            height: 1.0,
            drawingShape: "POLYLINE",
            strokeColor: "#FEAE00",
            strokeOpacity: 0.8,
            strokeWidth: 4,
            strokeWidthUnit: "PX",
            mainQtyKey: "S",
        },
        {
            label: "Sol",
            labelLegend: "Tectoproof CA-N au sol",
            drawingShape: "POLYGON",
            fillColor: "#4a9410ff",
            fillType: "HATCHING",
            fillOpacity: 0.8,
            mainQtyKey: "S",
        },
        {
            label: "Retours plafond [ht 1.00 m]",
            labelLegend: "Tectoproof CA-N en retours plafond sur 1,00m",
            height: 1.0,
            drawingShape: "POLYGON",
            strokeColor: "#AE7F44",
            strokeOpacity: 0.8,
            strokeWidth: 20,
            strokeWidthUnit: "CM",
            mainQtyKey: "S",
        }

    ]
}

export default CUVELAGE_TECTOPROOF;
