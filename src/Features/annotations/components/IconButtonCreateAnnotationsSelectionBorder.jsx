import { useState } from "react";
import { useSelector, useDispatch } from "react-redux";

import { setSelectedNode, setSelectedNodes } from "Features/mapEditor/mapEditorSlice";

import useMainBaseMap from "Features/mapEditor/hooks/useMainBaseMap";
import useAnnotationTemplates from "../hooks/useAnnotationTemplates";
import useCreateAnnotationsBorder from "../hooks/useCreateAnnotationsBorder";

import { IconButton, Menu } from "@mui/material";
import { SelectAll } from "@mui/icons-material";

import SelectorAnnotationTemplateVariantDense from "./SelectorAnnotationTemplateVariantDense";


export default function IconButtonCreateAnnotationsSelectionBorder() {

    const dispatch = useDispatch();

    // data

    const selectedNodes = useSelector((s) => s.mapEditor.selectedNodes);
    const filterByListingId = useSelector((s) => s.listings.selectedListingId);
    const baseMap = useMainBaseMap()

    const annotationTemplates = useAnnotationTemplates({ filterByListingId });

    const createBorder = useCreateAnnotationsBorder();

    // state

    const [anchorEl, setAnchorEl] = useState(null);
    const open = Boolean(anchorEl);

    // helpers

    const disabled = !Boolean(baseMap?.meterByPx);

    // handlers

    function handleOpen(event) {
        setAnchorEl(event.currentTarget);
    }

    function handleClose() {
        setAnchorEl(null);
    }

    async function handleTemplateChange(annotationTemplateId) {
        try {
            const annotationIds = selectedNodes.map(node => node.nodeId)
            const newAnnotation = await createBorder({ annotationIds, annotationTemplateId, offset: 0.6 })
            console.log("NEW_ANNOTATION", newAnnotation)
        } catch (e) {
            console.error(e)
        } finally {
            handleClose();
            dispatch(setSelectedNode(null));
            dispatch(setSelectedNodes(null));
        }

    }

    return <>
        <IconButton onClick={handleOpen} disabled={disabled}>
            <SelectAll />
        </IconButton>

        <Menu
            open={open}
            anchorEl={anchorEl}
            onClose={handleClose}
            anchorOrigin={{
                vertical: "bottom",
                horizontal: "right",
            }}
            transformOrigin={{
                vertical: "top",
                horizontal: "right",
            }}
        >
            <SelectorAnnotationTemplateVariantDense
                selectedAnnotationTemplateId={null}
                onChange={handleTemplateChange}
                annotationTemplates={annotationTemplates}
            />
        </Menu>
    </>
}