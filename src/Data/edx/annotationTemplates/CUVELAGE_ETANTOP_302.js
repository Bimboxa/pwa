import { blue, brown, orange, purple, red } from "@mui/material/colors"

const CUVELAGE_ETANTOP_302 = {
    key: "CUVELAGE_ETANTOP_302",
    name: "Cuvelage - Etantop",
    iconKey: "shapes",
    color: blue[500],
    keywords: ["type:repérage", "secteur:cuvelage", "système:etantop"],
    articlesNomenclaturesKeys: ["CUVELAGE"],
    templates: [
        {
            label: "VCT [ht 3.17 m]",
            labelLegend: "Etantop 302 CA-N en VCT sur 3,17m",
            height: 3.17,
            drawingShape: "POLYLINE",
            strokeColor: "#2d43d1ff",
            strokeOpacity: 0.8,
            strokeWidth: 4,
            strokeWidthUnit: "PX",
            mainQtyKey: "S",
            mappingCategories: ["OUVRAGE:VCT"],
            overrideFields: ["height", "strokeColor", "strokeWidth", "strokeWidthUnit"],
        },
        {
            label: "Voiles [ht 1.00 m]",
            labelLegend: "Etantop en voiles sur 1,00m",
            height: 1.0,
            drawingShape: "POLYLINE",
            strokeColor: "#FEAE00",
            strokeOpacity: 0.8,
            strokeWidth: 4,
            strokeWidthUnit: "PX",
            mainQtyKey: "S",
            mappingCategories: ["OUVRAGE:VI"],
            overrideFields: ["height", "strokeColor", "strokeWidth", "strokeWidthUnit"],
        },
        {
            label: "Sol (Kentrec MR)",
            labelLegend: "Kentrec MR au sol",
            drawingShape: "POLYGON",
            fillColor: "#305d0eff",
            fillType: "HATCHING",
            fillOpacity: 0.8,
            mainQtyKey: "S",
            mappingCategories: ["OUVRAGE:SOL"],
            overrideFields: ["fillColor"],
        },
        {
            label: "Fosses",
            labelLegend: "Etantop 302 en fosses",
            drawingShape: "POLYGON",
            fillColor: "#f1e457ff",
            fillOpacity: 0.8,
            mainQtyKey: "S",
            overrideFields: ["fillColor"],
        }

    ]
}

export default CUVELAGE_ETANTOP_302;
