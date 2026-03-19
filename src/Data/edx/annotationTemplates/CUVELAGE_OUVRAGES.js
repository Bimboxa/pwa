import { purple } from "@mui/material/colors"

const CUVELAGE_OUVRAGES = {
    key: "CUVELAGE_OUVRAGES",
    name: "Cuvelage - ouvrages à traiter",
    iconKey: "shapes",
    color: purple[500],
    keywords: ["type:repérage", "secteur:cuvelage"],
    templates: [
        {
            label: "Sol",
            labelLegend: "Sol",
            drawingShape: "POLYGON",
            fillColor: "#4a9410ff",
            fillType: "HATCHING",
            fillOpacity: 0.8,
            mainQtyKey: "S",
        },
        {
            label: "VCT - parement [ht 3.17 m]",
            labelLegend: "Voiles contre terre - parement sur 3,17m",
            height: 3.17,
            drawingShape: "POLYLINE",
            strokeColor: "#de9454ff",
            mainQtyKey: "S",
            strokeWidth: 4,
            strokeWidthUnit: "PX",
            mappingCategories: ["OUVRAGE:VCT"]
        },
        {
            label: "Voiles int. et poteaux - parement [ht 1.00 m]",
            labelLegend: "Voiles intérieurs et poteaux - parement sur 1,00m",
            height: 1.0,
            drawingShape: "POLYLINE",
            strokeColor: "#FF644E",
            strokeWidth: 4,
            strokeWidthUnit: "PX",
            mainQtyKey: "S",
            mappingCategories: ["OUVRAGE:VI"]
        },
    ]
}

export default CUVELAGE_OUVRAGES;
