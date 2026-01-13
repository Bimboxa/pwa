import { useDispatch, useSelector } from "react-redux";

import { setShowCreateBaseMapSection } from "Features/mapEditor/mapEditorSlice";

import useBaseMaps from "Features/baseMaps/hooks/useBaseMaps";

import { Box } from "@mui/material";

import SectionCreateBaseMapFullscreen from "Features/mapEditor/components/SectionCreateBaseMapFullscreen";

export default function LayerCreateBaseMap() {
    const dispatch = useDispatch();

    // data

    const show = useSelector((s) => s.mapEditor.showCreateBaseMapSection);
    const projectId = useSelector(s => s.projects.selectedProjectId);
    const { value: baseMaps } =
        useBaseMaps({ filterByProjectId: projectId }) ?? {};

    // handlers

    function handleClose() {
        dispatch(setShowCreateBaseMapSection(false));
    }

    // helper

    const showClose = baseMaps?.length > 0;
    //const showClose = true;

    // render

    if (!show) return null;

    return (
        <Box sx={{
            bgcolor: "background.default",
            position: "absolute", top: 0, left: 0,
            width: "100%", height: "100%",
            zIndex: 1000
        }}>
            <SectionCreateBaseMapFullscreen onClose={handleClose} showClose={showClose} />
        </Box>
    );
}