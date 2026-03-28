import { useMemo } from "react";
import { useDispatch } from "react-redux";
import { DataGridPro } from "@mui/x-data-grid-pro";
import Box from "@mui/material/Box";
import IconButton from "@mui/material/IconButton";
import MapIcon from "@mui/icons-material/Map";

import AnnotationIcon from "./AnnotationIcon";
import AnnotationEntityInfoChip from "./AnnotationEntityInfoChip";

import {
    setSelectedMainBaseMapId,
    setSelectedNode,
    setZoomTo,
} from "Features/mapEditor/mapEditorSlice";
import { setSelectedItem, setShowAnnotationsProperties } from "Features/selection/selectionSlice";
import { setSelectedMenuItemKey } from "Features/rightPanel/rightPanelSlice";
import { setSelectedViewerKey } from "Features/viewers/viewersSlice";
import useBaseMaps from "Features/baseMaps/hooks/useBaseMaps";
import getItemsByKey from "Features/misc/utils/getItemsByKey";
import getAnnotationQties from "Features/annotations/utils/getAnnotationQties";

import db from "App/db/db";
import BoxFlexVStretch from "Features/layout/components/BoxFlexVStretch";

const formatNumber = (value, unit) => {
    if (value === null || value === undefined || isNaN(value)) return "-";
    value = Number(value);
    return `${value.toFixed(2)} ${unit}`;
};

export default function DatagridAnnotations({
    annotations,
    selectedIds = [],
    onSelectionChange,
    onClose,
    showListingName = false,
    showLayerName = false,
}) {


    const dispatch = useDispatch();

    // --- DATA PREP ---

    const { value: baseMaps } = useBaseMaps() ?? {};
    const baseMapById = useMemo(() => getItemsByKey(baseMaps ?? [], "id"), [baseMaps]);

    // HELPERS

    const editableFields = ["height"];

    // --- ROWS ---

    const rows = useMemo(() => {
        if (!annotations) return [];
        return annotations.filter(annotation => Boolean(annotation.id)).map((annotation) => {


            return {
                id: annotation.id,
                type: annotation.type,
                baseMapId: annotation.baseMapId,
                listingId: annotation.listingId,
                entityId: annotation.entityId,
                annotationTemplateId: annotation.annotationTemplateId,
                baseMapName: annotation.baseMapName,
                variant: annotation.variant,
                fillColor: annotation.fillColor,
                fillType: annotation.fillType,
                strokeColor: annotation.strokeColor,
                listingName: annotation.listingName,
                layerName: annotation.layerName,
                templateLabel: annotation.annotationTemplateProps?.label || "Sans Label",
                height: annotation.height,
                length: annotation.qties?.enabled ? annotation.qties.length : 0,
                surface: annotation.qties?.enabled ? annotation.qties.surface : 0,
                points: annotation.points,
                x: annotation.x,
                y: annotation.y,
                entity: annotation.entity,
            };
        });
    }, [annotations, baseMapById]);

    // --- COLUMNS ---
    const columns = useMemo(() => {
        const cols = [
            {
                field: "icon",
                headerName: "",
                width: 50,
                align: "center",
                headerAlign: "center",
                sortable: false,
                filterable: false,
                disableColumnMenu: true,
                renderCell: (params) => {
                    return <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", height: 1 }}><AnnotationIcon annotation={params.row} /></Box>;
                }
            },
            {
                field: "entityInfo",
                headerName: "",
                width: 36,
                align: "center",
                headerAlign: "center",
                sortable: false,
                filterable: false,
                disableColumnMenu: true,
                renderCell: (params) => {
                    if (!params.row.entity) return null;
                    return (
                        <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", height: 1 }}>
                            <AnnotationEntityInfoChip entity={params.row.entity} />
                        </Box>
                    );
                },
            },
            { field: "templateLabel", headerName: "Modèle", flex: 1, minWidth: 150 },
        ];
        if (showListingName) {
            cols.push({ field: "listingName", headerName: "Liste", flex: 1, minWidth: 150 });
        }
        cols.push(
            { field: "baseMapName", headerName: "Fond de plan", flex: 1, minWidth: 150 },
        );
        if (showLayerName) {
            cols.push({ field: "layerName", headerName: "Calque", flex: 1, minWidth: 120 });
        }
        cols.push(
            {
                field: "height", headerName: "Hauteur", width: 120, type: "number",
                valueFormatter: (value) => formatNumber(value, "m"),
                editable: true,
            },
            { field: "length", headerName: "Longueur", width: 120, type: "number", valueFormatter: (value) => formatNumber(value, "m") },
            { field: "surface", headerName: "Surface", width: 120, type: "number", valueFormatter: (value) => formatNumber(value, "m²") },
        );
        cols.push({
            field: "actions",
            headerName: "",
            width: 50,
            align: "center",
            headerAlign: "center",
            sortable: false,
            filterable: false,
            disableColumnMenu: true,
            renderCell: (params) => (
                <IconButton
                    size="small"
                    onClick={(e) => {
                        e.stopPropagation();
                        handleViewOnMap(params.row);
                    }}
                    sx={{ color: "action.active" }}
                >
                    <MapIcon fontSize="small" />
                </IconButton>
            ),
        });
        return cols;
    }, [showListingName, showLayerName]);

    const internalRowSelectionModel = useMemo(() => {
        return { type: "include", ids: new Set(selectedIds ?? []) };
    }, [selectedIds]);


    // handlers

    function handleViewOnMap(row) {
        // Close the dialog if open
        if (onClose) onClose();
        // Navigate to the correct baseMap and viewer
        dispatch(setSelectedMainBaseMapId(row.baseMapId));
        dispatch(setSelectedViewerKey("MAP"));
        // Select the annotation node in mapEditor
        dispatch(setSelectedNode({
            nodeId: row.id,
            nodeType: "ANNOTATION",
            nodeListingId: row.listingId,
            annotationType: row.type,
            origin: "LISTING",
        }));
        // Select the annotation in the selection slice
        dispatch(setSelectedItem({
            id: row.id,
            type: "NODE",
            nodeType: "ANNOTATION",
            nodeId: row.id,
            annotationType: row.type,
            listingId: row.listingId,
            entityId: row.entityId,
            annotationTemplateId: row.annotationTemplateId,
        }));
        // Show the properties panel
        dispatch(setShowAnnotationsProperties(true));
        dispatch(setSelectedMenuItemKey("SELECTION_PROPERTIES"));
        // Zoom to the annotation
        if (row.points?.length > 0) {
            dispatch(setZoomTo(row.points[0]));
        } else if (row.x != null) {
            dispatch(setZoomTo({ x: row.x, y: row.y }));
        }
    }

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