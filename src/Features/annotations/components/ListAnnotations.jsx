
import { useDispatch, useSelector } from "react-redux";

import { setSelectedMainBaseMapId, setSelectedNode } from "Features/mapEditor/mapEditorSlice";


import { List, ListItemButton, Box, Typography } from "@mui/material";
import AnnotationIcon from "./AnnotationIcon";

import BoxAlignToRight from "Features/layout/components/BoxAlignToRight";

import getAnnotationQties from "../utils/getAnnotationQties";
import getAnnotationMainQtyLabel from "../utils/getAnnotationMainQtyLabel";
import stringifyAnnotationQties from "../utils/stringifyAnnotationQties";



export default function ListAnnotations({ annotations }) {
    const dispatch = useDispatch();
    const selectedNode = useSelector(s => s.mapEditor.selectedNode);
    const baseMapId = useSelector(s => s.mapEditor.selectedMainBaseMapId);

    // handlers

    const handleAnnotationClick = (annotation) => {
        if (annotation.isBaseMap) {
            dispatch(setSelectedMainBaseMapId(annotation.id))
            dispatch(setSelectedNode(null))
        } else {
            dispatch(setSelectedMainBaseMapId(annotation.baseMapId))
            dispatch(setSelectedNode({
                nodeType: "ANNOTATION",
                nodeId: annotation.id,
                nodeListingId: annotation.listingId,
                annotationType: annotation.type,
                origin: "LISTING"
            }))
        }
    }

    // render

    return <List dense>
        {annotations?.map((annotation) => {

            if (annotation.isBaseMap) return <ListItemButton
                key={annotation.id} divider dense
                onClick={() => handleAnnotationClick(annotation)}
            >
                <Box sx={{ display: "flex", width: 1, p: 0.5 }}>
                    <Typography variant="body2" color="text.secondary">{annotation.baseMap.name}</Typography>
                </Box>
            </ListItemButton>

            // --- QTY ---

            const qties = annotation?.qties;
            const mainQtyLabel = getAnnotationMainQtyLabel(annotation, qties);
            const qtiesS = stringifyAnnotationQties(qties);

            return <ListItemButton
                key={annotation.id}
                divider sx={{ bgcolor: "common.white" }}
                onClick={() => handleAnnotationClick(annotation)}
                selected={selectedNode?.nodeId === annotation.id}
            >
                <Box sx={{ width: 1 }}>
                    <Box sx={{
                        display: "flex",
                        width: 1, alignItems: "center", justifyContent: "space-between"
                    }}>
                        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                            <AnnotationIcon annotation={annotation} size={24} />
                            <Typography variant="body2">{annotation.label}</Typography>
                        </Box>
                        <Typography variant="caption">{mainQtyLabel}</Typography>
                    </Box>

                    <BoxAlignToRight>
                        <Typography variant="caption" sx={{ color: "text.secondary" }}>{qtiesS}</Typography>
                    </BoxAlignToRight>
                </Box>

            </ListItemButton>
        })}
    </List>
}