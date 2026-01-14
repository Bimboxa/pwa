import { useSelector, useDispatch } from "react-redux"

import { setEnabledDrawingMode } from "Features/mapEditor/mapEditorSlice";

import { IconButton } from "@mui/material";
import { AutoAwesome } from "@mui/icons-material";

export default function IconButtonStartTransformer() {
    const dispatch = useDispatch();

    // handlers

    function handleClick() {
        console.log("handleClick");
        dispatch(setEnabledDrawingMode("SMART_TRANSFORMER"))
    }

    return (
        <IconButton onClick={handleClick}>
            <AutoAwesome />
        </IconButton>
    );
}