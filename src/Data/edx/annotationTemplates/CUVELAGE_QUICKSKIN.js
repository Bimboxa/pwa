import { blue, brown, orange, purple, red } from "@mui/material/colors"

const CUVELAGE_QUICKSKIN = {
    key: "CUVELAGE_QUICKSKIN",
    name: "Cuvelage - Quicksin",
    iconKey: "shapes",
    color: blue[500],
    keywords: ["type:repérage", "secteur:cuvelage", "système:etantop"],
    articlesNomenclaturesKeys: ["CUVELAGE"],
    templates: [
        {
            label: "VCT [ht 3.17 m] (Etantop 302)",
            labelLegend: "Etantop 302 en VCT sur 3,17m",
            height: 3.17,
            drawingShape: "POLYLINE",
            strokeColor: "#2d43d1ff",
            strokeOpacity: 0.8,
            strokeWidth: 4,
            strokeWidthUnit: "PX",
            mainQtyKey: "S",
        },
        {
            label: "Sol",
            labelLegend: "Quicksin au sol",
            drawingShape: "POLYGON",
            fillColor: "#62a72dff",
            fillType: "HATCHING",
            fillOpacity: 0.8,
            mainQtyKey: "S",
        },
        {
            label: "Fosses (Etantop 302)",
            labelLegend: "Etantop 302 en fosses",
            drawingShape: "POLYGON",
            fillColor: "#f1e457ff",
            fillOpacity: 0.8,
            mainQtyKey: "S",
        }

    ]
}

export default CUVELAGE_QUICKSKIN;
