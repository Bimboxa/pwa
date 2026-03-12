import { useState } from "react";

import useCloneAnnotationAndEntity from "Features/mapEditor/hooks/useCloneAnnotationAndEntity";
import useAnnotationTemplateCandidates from "Features/annotations/hooks/useAnnotationTemplateCandidates";

import { Tooltip, Menu, IconButton } from "@mui/material";
import { ContentCopy } from "@mui/icons-material";


import SelectorAnnotationTemplateVariantDense from "./SelectorAnnotationTemplateVariantDense";

import getAnnotationTemplateProps from "../utils/getAnnotationTemplateProps";

export default function IconButtonCloneAnnotation({ annotation }) {

    // strings

    const title = "Cloner l'annotation";

    // state

    const [anchorEl, setAnchorEl] = useState(null);
    const open = Boolean(anchorEl);


    // data

    const { candidates: annotationTemplates, listings } =
        useAnnotationTemplateCandidates(annotation) ?? {};
    const cloneAnnotationAndEntity = useCloneAnnotationAndEntity();

    // handlers

    function handleOpen(event) {
        setAnchorEl(event.currentTarget);
    }

    function handleClose() {
        setAnchorEl(null);
    }

    async function handleTemplateChange(annotationTemplateId) {
        const template = annotationTemplates?.find((t) => t.id === annotationTemplateId);
        const newAnnotation = {
            ...getAnnotationTemplateProps(template),
            annotationTemplateId: template?.id,
            label: template?.label,
        };
        // Derive the correct annotation type from the target template drawingShape
        const drawingShape = template?.drawingShape ?? template?.type;
        if (drawingShape === "POLYLINE_2D") newAnnotation.type = "POLYLINE";
        else if (drawingShape === "SURFACE_2D") newAnnotation.type = "POLYGON";
        else if (drawingShape === "POINT_2D") newAnnotation.type = "MARKER";

        await cloneAnnotationAndEntity(annotation, { newAnnotation });
        handleClose();
    }

    return <>
        <Tooltip title={title}>
            <IconButton onClick={handleOpen}>
                <ContentCopy />
            </IconButton>
        </Tooltip>
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
                selectedAnnotationTemplateId={annotation?.annotationTemplateId}
                onChange={handleTemplateChange}
                annotationTemplates={annotationTemplates}
                listings={listings}
            />
        </Menu>
    </>
}