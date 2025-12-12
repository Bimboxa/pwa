import { useSelector, useDispatch } from "react-redux";

import { setEnabledDrawingMode } from "../mapEditorSlice";

import { Paper, Box } from "@mui/material";
import { Mouse, Rectangle, WaterDrop } from "@mui/icons-material";

import ToggleSingleSelectorGeneric from "Features/layout/components/ToggleSingleSelectorGeneric";
import ToolbarNewAnnotation from "Features/annotations/components/ToolbarNewAnnotation";

export default function ToolbarEnabledDrawingMode() {

    const dispatch = useDispatch();

    // data

    const enabledDrawingMode = useSelector((s) => s.mapEditor.enabledDrawingMode);
    const newAnnotation = useSelector((s) => s.annotations.newAnnotation);
    const type = newAnnotation?.type;

    // options

    const options = [
        {
            key: "CLICK",
            label: "Clic",
            icon: <Mouse />
        },
        {
            key: "RECTANGLE",
            label: "Rectangle",
            icon: <Rectangle />
        },
        {
            key: "DROP_FILL",
            label: "Remplissage",
            icon: <WaterDrop />
        }
    ]

    // helpers - show mode

    const showMode = ["POLYLINE", "POLYGONE"].includes(type);

    // handlers

    function handleChange(mode) {
        dispatch(setEnabledDrawingMode(mode));
    }

    // render

    if (!showMode) return null;

    return <Paper
        sx={{ display: "flex", alignItems: "center", p: 1 }
        }>
        <ToggleSingleSelectorGeneric
            options={options}
            selectedKey={enabledDrawingMode}
            onChange={handleChange}
        />
    </Paper >

}