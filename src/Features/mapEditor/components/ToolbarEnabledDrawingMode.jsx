import { useSelector, useDispatch } from "react-redux";

import { setEnabledDrawingMode } from "../mapEditorSlice";

import { Paper } from "@mui/material";
import { Mouse, Rectangle, WaterDrop } from "@mui/icons-material";

import ToggleSingleSelectorGeneric from "Features/layout/components/ToggleSingleSelectorGeneric";

export default function ToolbarEnabledDrawingMode() {

    const dispatch = useDispatch();

    // data

    const enabledDrawingMode = useSelector((s) => s.mapEditor.enabledDrawingMode);

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
    // handlers

    function handleChange(mode) {
        dispatch(setEnabledDrawingMode(mode));
    }

    // render

    return <Paper sx={{ display: "flex", alignItems: "center", p: 1 }}>
        <ToggleSingleSelectorGeneric
            options={options}
            selectedKey={enabledDrawingMode}
            onChange={handleChange}
        />
    </Paper >
}