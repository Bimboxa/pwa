import { useSelector, useDispatch } from "react-redux";

import { setEnabledDrawingMode } from "../mapEditorSlice";

import { Paper, Box } from "@mui/material";
import { Mouse, Rectangle, WaterDrop, MyLocation as TARGET, Brush, Insights as Smart } from "@mui/icons-material";
import theme from "Styles/theme";

import ToggleSingleSelectorGeneric from "Features/layout/components/ToggleSingleSelectorGeneric";


import getAnnotationColor from "Features/annotations/utils/getAnnotationColor";

export default function ToolbarEnabledDrawingMode({ allAnnotations }) {

    const dispatch = useDispatch();

    // data

    const enabledDrawingMode = useSelector((s) => s.mapEditor.enabledDrawingMode);
    const newAnnotation = useSelector((s) => s.annotations.newAnnotation);
    const type = newAnnotation?.type;

    // helper

    const color = getAnnotationColor(newAnnotation) ?? theme.palette.secondary.main;

    // helper - show one click

    let showOneClick = ["MARKER", "POINT", "IMAGE"].includes(type);
    if (type === "RECTANGLE" && (newAnnotation?.size?.width && newAnnotation?.size?.height)) showOneClick = true;


    // options

    const options = [
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
            show: ["POLYLINE", "POLYGON", "STRIP", "CUT"].includes(type)
        },
        {
            key: "RECTANGLE",
            label: "Rectangle",
            icon: <Rectangle sx={{ color }} />,
            show: ["POLYGON", "POLYLINE", "RECTANGLE"].includes(type)
        },
        {
            key: "DROP_FILL",
            label: "Remplissage",
            icon: <WaterDrop sx={{ color }} />,
            show: ["POLYGON", "RECTANGLE"].includes(type)
        },
        {
            key: "BRUSH",
            label: "Brush",
            icon: <Brush sx={{ color }} />,
            //show: ["POLYGON"].includes(type),
            show: false
        },
        {
            key: "SMART_DETECT",
            label: "Détection automatique",
            icon: <Smart sx={{ color }} />,
            //show: ["POLYLINE"].includes(type)
            show: false
        },
    ]

    // helpers - show mode

    const showMode = ["POLYLINE", "POLYGON", "STRIP", "CUT", "MARKER", "POINT", "IMAGE", "RECTANGLE"].includes(type);

    // handlers

    function handleChange(mode) {
        dispatch(setEnabledDrawingMode(mode));
    }

    // render

    if (!showMode) return null;

    return <Paper
        sx={{ display: "flex", alignItems: "center", p: 0 }
        }>
        <ToggleSingleSelectorGeneric
            options={options.filter(o => o.show)}
            selectedKey={enabledDrawingMode}
            onChange={handleChange}
        />
    </Paper >

}