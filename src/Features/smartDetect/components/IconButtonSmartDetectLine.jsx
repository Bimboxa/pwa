import { useDispatch } from "react-redux"

import { setEnabledDrawingMode } from "Features/mapEditor/mapEditorSlice";


import { IconButton } from "@mui/material"
import { Insights as SmartDetectLineIcon } from "@mui/icons-material"
export default function IconButtonSmartDetectLine() {
    const dispatch = useDispatch();

    const handleClick = () => {
        dispatch(setEnabledDrawingMode("SMART_DETECT_LINE"))
    }
    return <IconButton onClick={handleClick}>
        <SmartDetectLineIcon />
    </IconButton>

}