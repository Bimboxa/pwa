import { useDispatch, useSelector } from "react-redux";

import useAnnotationTemplatesBySelectedListing from "../hooks/useAnnotationTemplatesBySelectedListing";

import { selectSelectedItem, triggerSelectionBack } from "Features/selection/selectionSlice";

import { Box, Typography, IconButton } from "@mui/material";
import { ArrowBack as Back } from "@mui/icons-material";

import FormAnnotationTemplateVariantBlock from "./FormAnnotationTemplateVariantBlock";
import useUpdateAnnotationTemplate from "../hooks/useUpdateAnnotationTemplate";
import BoxFlexVStretch from "Features/layout/components/BoxFlexVStretch";
import IconButtonMoreActionsAnnotationTemplate from "./IconButtonMoreActionsAnnotationTemplate";



export default function PanelAnnotationTemplateProperties() {

    const dispatch = useDispatch();

    // strings

    const title = "Modèle d'annotation"


    // data

    const annotationTemplates = useAnnotationTemplatesBySelectedListing()

    const selectedItem = useSelector(selectSelectedItem)

    const selectedAnnotationTemplate = annotationTemplates?.find(a => a.id === selectedItem?.id)

    const updateAnnotationTemplate = useUpdateAnnotationTemplate();


    // helper

    const label = selectedAnnotationTemplate?.label ?? "-?-"

    // handler

    function handleChange(newAnnotationTemplate) {
        updateAnnotationTemplate(newAnnotationTemplate)
    }


    // render

    return <BoxFlexVStretch sx={{}}>
        <Box sx={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            p: 0.5,
            pl: 1,
        }}>
            <Box sx={{ display: "flex", alignItems: "center" }}>
                <IconButton onClick={() => dispatch(triggerSelectionBack())}>
                    <Back />
                </IconButton>

                <Typography variant="body2" sx={{ fontWeight: "bold", ml: 1 }}>{label}</Typography>
            </Box>

            <IconButtonMoreActionsAnnotationTemplate annotationTemplate={selectedAnnotationTemplate} />
        </Box>

        <FormAnnotationTemplateVariantBlock
            annotationTemplate={selectedAnnotationTemplate}
            onChange={handleChange}
        />
    </BoxFlexVStretch>
}

