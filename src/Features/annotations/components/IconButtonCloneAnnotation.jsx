import { useState } from "react";

import { useSelector } from "react-redux";

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

    const filterByListingId = useSelector((s) => s.listings.selectedListingId);
    const annotationTemplates = useAnnotationTemplateCandidates(annotation, { filterByListingId });
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
            />
        </Menu>
    </>
}