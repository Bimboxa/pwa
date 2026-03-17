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
            drawingShape: "POLYGON",
            fillColor: "#4a9410ff",
            fillType: "HATCHING",
            fillOpacity: 0.8,
            mainQtyKey: "S",
        },
        {
            label: "Voiles contre terre - parement",
            drawingShape: "POLYLINE",
            strokeColor: "#de9454ff",
            mainQtyKey: "S",
            strokeWidth: 4,
            strokeWidthUnit: "PX",
            mappingCategories: ["OUVRAGE:VCT"]
        },
        {
            drawingShape: "POLYLINE",
            label: "Voiles intérieurs et poteaux - parement",
            strokeColor: "#FF644E",
            strokeWidth: 4,
            strokeWidthUnit: "PX",
            mainQtyKey: "S",
            mappingCategories: ["OUVRAGE:VI"]
        },
    ]
}

export default CUVELAGE_OUVRAGES;
