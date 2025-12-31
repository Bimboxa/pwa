
import { useDispatch } from "react-redux";
import { useSelector } from "react-redux";

import { setEditedBaseMap } from "../baseMapsSlice";

import { Box } from "@mui/material";

import FormBaseMapVariantEdit from "./FormBaseMapVariantEdit";


export default function PanelEditBaseMap() {
    const dispatch = useDispatch();

    // data

    const editedBaseMap = useSelector(s => s.baseMaps.editedBaseMap);

    // handlers

    function handleChange(baseMap) {
        dispatch(setEditedBaseMap(baseMap))
    }


    return <Box>
        <FormBaseMapVariantEdit baseMap={editedBaseMap} onChange={handleChange} />
    </Box>
}