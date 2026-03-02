import { useSelector, useDispatch } from "react-redux";

import { setEnabledDrawingMode } from "../mapEditorSlice";
import { setNewAnnotation } from "Features/annotations/annotationsSlice";

import { Paper, Box, Typography } from "@mui/material";
import { Mouse, Rectangle, RadioButtonUnchecked, WaterDrop, MyLocation as TARGET, Brush, Insights as Smart } from "@mui/icons-material";
import theme from "Styles/theme";

import ToggleSingleSelectorGeneric from "Features/layout/components/ToggleSingleSelectorGeneric";

import getAnnotationColor from "Features/annotations/utils/getAnnotationColor";
import { getDrawingToolByKey, getDrawingToolsByShape } from "../constants/drawingTools.jsx";
import { resolveShapeCategory } from "Features/annotations/constants/drawingShapes.jsx";

export default function ToolbarEnabledDrawingMode() {

    const dispatch = useDispatch();

    // strings

    const drawS = "Outils de dessin"

    // data

    const enabledDrawingMode = useSelector((s) => s.mapEditor.enabledDrawingMode);
    const newAnnotation = useSelector((s) => s.annotations.newAnnotation);
    const type = newAnnotation?.type;
    const drawingShape = newAnnotation?.drawingShape;

    // helper

    const color = getAnnotationColor(newAnnotation) ?? theme.palette.secondary.main;

    // options — use drawingShape when available (new template system),
    // fall back to type-based options for legacy templates.

    let options;

    if (drawingShape) {
        // New system: derive tools from drawingShape
        const shapeCategory = resolveShapeCategory(drawingShape);
        const iconColor = shapeCategory === "polyline"
            ? (newAnnotation?.strokeColor ?? newAnnotation?.fillColor ?? color)
            : (newAnnotation?.fillColor ?? newAnnotation?.strokeColor ?? color);

        const tools = getDrawingToolsByShape(drawingShape);
        options = tools.map(({ key, label, Icon }) => ({
            key,
            label,
            icon: <Icon sx={{ color: iconColor }} />,
            show: true,
        }));
    } else {
        // Legacy system: derive tools from type
        let showOneClick = ["LABEL", "MARKER", "POINT", "IMAGE"].includes(type);
        if (type === "RECTANGLE" && (newAnnotation?.size?.width && newAnnotation?.size?.height)) showOneClick = true;

        options = [
            {
                key: "ONE_CLICK",
                label: "1 Clic",
                icon: <TARGET sx={{ color }} />,
                show: showOneClick
            },
            {
                key: "CLICK",
                label: "Clic",
                icon: <Mouse sx={{ color }} />,
                show: ["POLYLINE", "POLYGON", "STRIP", "CUT", "SPLIT"].includes(type)
            },
            {
                key: "RECTANGLE",
                label: "Rectangle",
                icon: <Rectangle sx={{ color }} />,
                show: ["POLYGON", "POLYLINE", "RECTANGLE", "CUT", "SPLIT"].includes(type)
            },
            {
                key: "CIRCLE",
                label: "Cercle",
                icon: <RadioButtonUnchecked sx={{ color }} />,
                show: ["POLYGON", "POLYLINE"].includes(type)
            },
            {
                key: "SURFACE_DROP",
                label: "Remplissage",
                icon: <WaterDrop sx={{ color }} />,
                show: ["POLYGON", "RECTANGLE"].includes(type)
            },
            {
                key: "BRUSH",
                label: "Brush",
                icon: <Brush sx={{ color }} />,
                show: false
            },
            {
                key: "SMART_DETECT",
                label: "Détection automatique",
                icon: <Smart sx={{ color }} />,
                show: false
            },
        ];
    }

    // helpers - show mode

    const showMode = drawingShape
        ? options.length > 0
        : ["POLYLINE", "POLYGON", "STRIP", "CUT", "SPLIT", "LABEL", "MARKER", "POINT", "IMAGE", "RECTANGLE"].includes(type);

    // handlers

    function handleChange(mode) {
        dispatch(setEnabledDrawingMode(mode));
        const tool = getDrawingToolByKey(mode);
        if (tool?.annotationType) {
            dispatch(setNewAnnotation({ ...newAnnotation, type: tool.annotationType }));
        }
    }

    // render

    if (!showMode) return null;

    return <Paper
        sx={{ display: "flex", alignItems: "center", flexDirection: "column" }
        }>
        <Paper elevation={0} sx={{ bgcolor: "background.default", px: 1, width: 1 }}>
            <Typography variant="caption" color="text.secondary">{drawS}</Typography>
        </Paper>

        <Box sx={{ p: 1 }}>
            <ToggleSingleSelectorGeneric
                options={options.filter(o => o.show)}
                selectedKey={enabledDrawingMode}
                onChange={handleChange}
            />
        </Box>

    </Paper >

}
