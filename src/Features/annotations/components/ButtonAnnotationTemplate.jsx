import { useState } from "react";

import useUpdateAnnotation from "../hooks/useUpdateAnnotation";
import useAnnotationTemplateCandidates from "../hooks/useAnnotationTemplateCandidates";

import { Button, Typography, Menu, MenuItem, Box } from "@mui/material";
import ArrowDropDownIcon from "@mui/icons-material/ArrowDropDown";

import SelectorAnnotationTemplateVariantDense from "./SelectorAnnotationTemplateVariantDense";
import AnnotationTemplateIcon from "./AnnotationTemplateIcon";

export default function ButtonAnnotationTemplate({ annotation, bgcolor = null, ...props }) {

    const [anchorEl, setAnchorEl] = useState(null);
    const open = Boolean(anchorEl);

    // data

    const { candidates: annotationTemplates, listings } =
        useAnnotationTemplateCandidates(annotation, { variant: "sameType" }) ?? {};
    const updateAnnotation = useUpdateAnnotation();


    // helpers

    const templateLabel = annotation?.templateLabel;

    // handlers

    const handleClick = (event) => {
        setAnchorEl(event.currentTarget);
    };

    const handleClose = () => {
        setAnchorEl(null);
    };

    async function handleTemplateChange(annotationTemplateId) {

        await updateAnnotation({ id: annotation.id, annotationTemplateId });
        handleClose();
    }


    return <>
        <Button endIcon={<ArrowDropDownIcon size="small" />} onClick={handleClick} sx={{ bgcolor }} {...props}>
            <Box sx={{ display: "flex", alignItems: "center", width: 1, gap: 1 }}>
                <AnnotationTemplateIcon template={annotation} />
                <Typography variant="body2" sx={{ ml: 1 }}>{templateLabel}</Typography>
            </Box>
        </Button>
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