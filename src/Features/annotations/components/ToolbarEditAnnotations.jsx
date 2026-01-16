import { useSelector } from "react-redux";

import { Box, Typography, Paper } from "@mui/material";
import { DragIndicator } from "@mui/icons-material";

import IconButtonMoreActionsSelectedAnnotations from "./IconButtonMoreActionsSelectedAnnotations";
import IconButtonCreateAnnotationsSelectionBorder from "./IconButtonCreateAnnotationsSelectionBorder";

import { PopperDragHandle } from "Features/layout/components/PopperBox";

export default function ToolbarEditAnnotations({ allAnnotations }) {

    // data

    const selectedNodes = useSelector((s) => s.mapEditor.selectedNodes);

    // helpers

    const annotations = allAnnotations.filter((a) => selectedNodes.map((n) => n.nodeId).includes(a.id));

    // helpers - selection count

    const count = selectedNodes?.length || 0;
    const countS = `${count} annotations sélectionnées`;

    return (
        <Paper elevation={6} sx={{ display: "flex", alignItems: "center", p: 0.5 }}>
            <PopperDragHandle>
                <Box sx={{ display: "flex", alignItems: "center", mr: 1 }}>
                    <DragIndicator fontSize="small" />
                </Box>
            </PopperDragHandle>

            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>

                <Typography variant="body2" sx={{ mr: 1 }}>
                    {countS}
                </Typography>

                <IconButtonCreateAnnotationsSelectionBorder />

                <IconButtonMoreActionsSelectedAnnotations annotations={annotations} />
            </Box>

        </Paper>


    );
}