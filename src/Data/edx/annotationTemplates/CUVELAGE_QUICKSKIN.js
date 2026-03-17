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
            label: "Etantop 302 en VCT sur x,xx m",
            drawingShape: "POLYLINE",
            strokeColor: "#2d43d1ff",
            strokeOpacity: 0.8,
            strokeWidth: 4,
            strokeWidthUnit: "PX",
            mainQtyKey: "S",
        },
        {
            label: "Quicksin au sol",
            drawingShape: "POLYGON",
            fillColor: "#62a72dff",
            fillType: "HATCHING",
            fillOpacity: 0.8,
            mainQtyKey: "S",
        },
        {
            label: "Etantop 302 en fosses",
            drawingShape: "POLYGON",
            fillColor: "#f1e457ff",
            fillOpacity: 0.8,
            mainQtyKey: "S",
        }

    ]
}

export default CUVELAGE_QUICKSKIN;
