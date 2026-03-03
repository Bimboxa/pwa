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
            label: "Etantop 302 CA-N en VCT sur 3,17m",
            drawingShape: "POLYLINE_2D",
            strokeColor: "#2d43d1ff",
            strokeOpacity: 0.8,
            drawingTools: ["POLYLINE_CLICK", "POLYLINE_RECTANGLE", "POLYLINE_CIRCLE_3_POINTS"],
            mappingCategories: ["OUVRAGE:VCT"]
        },
        {
            label: "Etantop en voiles sur 1,00m",
            drawingShape: "POLYLINE_2D",
            strokeColor: "#FEAE00",
            strokeOpacity: 0.8,
            drawingTools: ["POLYLINE_CLICK", "POLYLINE_RECTANGLE"],
            mappingCategories: ["OUVRAGE:VI"]
        },
        {
            label: "Kentrec MR au sol",
            drawingShape: "SURFACE_2D",
            fillColor: "#305d0eff",
            fillType: "HATCHING",
            fillOpacity: 0.8,
            drawingTools: ["POLYGON_CLICK", "POYLGON_CIRCLE_3_POINTS", "POLYGON_RECTANGLE", "DROP"],
        },
        {
            label: "Etantop 302 en fosses",
            drawingShape: "SURFACE_2D",
            fillColor: "#f1e457ff",
            fillOpacity: 0.8,
            drawingTools: ["POLYGON_RECTANGLE"],
        }

    ]
}

export default CUVELAGE_ETANTOP_302;