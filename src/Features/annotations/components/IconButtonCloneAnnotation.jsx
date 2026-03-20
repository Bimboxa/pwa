import { useState } from "react";

import useCloneAnnotationAndEntity from "Features/mapEditor/hooks/useCloneAnnotationAndEntity";
import useAnnotationTemplateCandidates from "Features/annotations/hooks/useAnnotationTemplateCandidates";

import { Tooltip, Menu, IconButton, Divider, Box, Typography } from "@mui/material";
import { ContentCopy } from "@mui/icons-material";

import ToggleSingleSelectorGeneric from "Features/layout/components/ToggleSingleSelectorGeneric";
import SelectorAnnotationTemplateVariantDense from "./SelectorAnnotationTemplateVariantDense";

import getAnnotationTemplateProps from "../utils/getAnnotationTemplateProps";
import { resolveDrawingShape, getAnnotationType } from "../constants/drawingShapeConfig";
import getCloneTypeOptions from "../utils/getCloneTypeOptions";

export default function IconButtonCloneAnnotation({ annotation }) {

    // strings

    const title = "Cloner l'annotation";

    // state

    const [anchorEl, setAnchorEl] = useState(null);
    const open = Boolean(anchorEl);
    const [selectedType, setSelectedType] = useState(annotation?.type);

    // data

    const { candidates: annotationTemplates, listings } =
        useAnnotationTemplateCandidates(annotation) ?? {};
    const cloneAnnotationAndEntity = useCloneAnnotationAndEntity();

    // helpers

    const typeOptions = getCloneTypeOptions(annotation?.type);

    // handlers

    function handleOpen(event) {
        setSelectedType(annotation?.type);
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
        // Derive the correct annotation type from the template's drawingShape
        const resolvedShape = resolveDrawingShape(template);
        const resolvedType = getAnnotationType(resolvedShape);
        if (resolvedType) newAnnotation.type = resolvedType;

        // Override type if user selected a different one
        if (selectedType) newAnnotation.type = selectedType;

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
            {typeOptions && (
                <>
                    <Divider />
                    <Box sx={{ px: 2, py: 1 }}>
                        <Typography variant="body2" sx={{ fontWeight: "bold", mb: 1 }}>
                            Type
                        </Typography>
                        <ToggleSingleSelectorGeneric
                            selectedKey={selectedType}
                            options={typeOptions}
                            onChange={(v) => setSelectedType(v ?? annotation?.type)}
                        />
                    </Box>
                </>
            )}
        </Menu>
    </>
}
