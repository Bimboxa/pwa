import { useMemo } from "react";
import { DataGridPro } from "@mui/x-data-grid-pro";
import Box from "@mui/material/Box";

import AnnotationIcon from "./AnnotationIcon";

import useBaseMaps from "Features/baseMaps/hooks/useBaseMaps";
import getItemsByKey from "Features/misc/utils/getItemsByKey";
import getAnnotationQties from "Features/annotations/utils/getAnnotationQties";

import db from "App/db/db";
import BoxFlexVStretch from "Features/layout/components/BoxFlexVStretch";

const formatNumber = (value, unit) => {
    if (value === null || value === undefined || isNaN(value)) return "-";
    return `${value.toFixed(2)} ${unit}`;
};

export default function DatagridAnnotations({
    annotations,
    selectedIds = [], // Valeur par défaut importante
    onSelectionChange
}) {


    // --- DATA PREP ---

    const { value: baseMaps } = useBaseMaps() ?? {};
    const baseMapById = useMemo(() => getItemsByKey(baseMaps ?? [], "id"), [baseMaps]);

    // HELPERS

    const editableFields = ["height"];

    // --- ROWS ---

    const rows = useMemo(() => {
        if (!annotations) return [];
        return annotations.map((annotation) => {


            return {
                id: annotation.id, // Assurez-vous que ceci est UNIQUE et non null
                type: annotation.type,
                baseMapName: annotation.baseMapName,
                variant: annotation.variant,
                fillColor: annotation.fillColor,
                fillType: annotation.fillType,
                strokeColor: annotation.strokeColor,
                templateLabel: annotation.annotationTemplateProps?.label || "Sans Label",
                height: annotation.height,
                length: annotation.qties?.enabled ? annotation.qties.length : 0,
                surface: annotation.qties?.enabled ? annotation.qties.surface : 0,
            };
        });
    }, [annotations, baseMapById]);

    // --- COLUMNS ---
    const columns = useMemo(() => [
        {
            field: "icon",
            headerName: "", // Pas de titre pour l'icône
            width: 50,
            align: "center",
            headerAlign: "center",
            sortable: false,
            filterable: false,
            disableColumnMenu: true,
            renderCell: (params) => {
                // params.row contient toutes les données de l'objet row ci-dessus
                return <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", height: 1 }}><AnnotationIcon annotation={params.row} /></Box>;
            }
        },
        { field: "templateLabel", headerName: "Modèle", flex: 1, minWidth: 150 },
        { field: "baseMapName", headerName: "Fond de plan", flex: 1, minWidth: 150 },
        {
            field: "height", headerName: "Hauteur", width: 120, type: "number",
            valueFormatter: (value) => formatNumber(value, "m"),
            editable: true,
        },

        { field: "length", headerName: "Longueur", width: 120, type: "number", valueFormatter: (value) => formatNumber(value, "m") },
        { field: "surface", headerName: "Surface", width: 120, type: "number", valueFormatter: (value) => formatNumber(value, "m²") }

    ], []);

    const internalRowSelectionModel = useMemo(() => {
        return { type: "include", ids: new Set(selectedIds ?? []) };
    }, [selectedIds]);


    // handler

    const handleSelectionChange = (newSelectionModel) => {
        const annotations = rows.filter(row => newSelectionModel.ids.has(row.id));
        console.log("annotations", annotations);
        if (onSelectionChange) {
            // Convertir le Set en tableau pour remonter les IDs
            onSelectionChange(Array.from(newSelectionModel.ids));
        }
    };

    async function handleFieldChange({ annotationId, field, value }) {
        await db.annotations.update(annotationId, { [field]: value });
        console.log("update annotation done !", field, value);
    }

    async function handleProcessRowUpdate(newRow) {
        const { id, height } = newRow;
        console.log("update annotation", id, height);
        await handleFieldChange({ annotationId: id, field: "height", value: height });

        return newRow;
    }


    return (
        <BoxFlexVStretch>
            <DataGridPro
                density="compact"
                rows={rows}
                columns={columns}
                rowSelectionModel={internalRowSelectionModel}
                onRowSelectionModelChange={handleSelectionChange}
                processRowUpdate={handleProcessRowUpdate}

                sx={{
                    border: "none", // Optionnel : retire la bordure globale

                    // Cible chaque ligne du tableau
                    "& .MuiDataGrid-row": {
                        bgcolor: "white", // Fond blanc
                        borderBottom: "1px solid #f0f0f0", // Optionnel : séparateur subtil
                    },

                    // Optionnel : Gestion du Hover sur fond blanc
                    "& .MuiDataGrid-row:hover": {
                        bgcolor: "#fafafa", // Gris très clair au survol
                    },

                    // Retire le contour bleu lors du focus sur une cellule
                    "& .MuiDataGrid-cell:focus": {
                        outline: "none"
                    }
                }}
            //checkboxSelection
            />
        </BoxFlexVStretch>
    );
}