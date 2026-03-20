import { useState } from "react";

import { useDispatch, useSelector } from "react-redux";

import useCloneAnnotationAndEntity from "Features/mapEditor/hooks/useCloneAnnotationAndEntity";

import BoxFlexVStretch from "Features/layout/components/BoxFlexVStretch";
import DialogGeneric from "Features/layout/components/DialogGeneric";
import FieldTextV2 from "Features/form/components/FieldTextV2";
import ButtonInPanelV2 from "Features/layout/components/ButtonInPanelV2";
import ToggleSingleSelectorGeneric from "Features/layout/components/ToggleSingleSelectorGeneric";

import { Typography, Box } from "@mui/material";

import useAnnotationTemplatesBySelectedListing from "../hooks/useAnnotationTemplatesBySelectedListing";

import SelectorAnnotationTemplateVariantList from "./SelectorAnnotationTemplateVariantList";
import { setNewAnnotation } from "../annotationsSlice";

import getNewAnnotationPropsFromAnnotationTemplate from "../utils/getNewAnnotationPropsFromAnnotationTemplate";
import getCloneTypeOptions from "../utils/getCloneTypeOptions";
import FieldToggleFWC from "Features/fwc/components/FieldToggleFWC";


export default function DialogCloneAnnotation({ open, onClose, annotation }) {
    const dispatch = useDispatch();

    // strings

    const title = "Cloner l'annotation";

    // data

    const cloneAnnotationAndEntity = useCloneAnnotationAndEntity();
    const annotationTemplates = useAnnotationTemplatesBySelectedListing();
    const newAnnotation = useSelector((state) => state.annotations.newAnnotation);


    // state
    const [entityLabel, setEntityLabel] = useState(null);
    const [fwc, setFwc] = useState(null);
    const [selectedType, setSelectedType] = useState(annotation?.type);

    // helpers

    const annotationTemplateId = newAnnotation?.annotationTemplateId;
    const typeOptions = getCloneTypeOptions(annotation?.type);

    // handlers

    function handleClose() {
        onClose();
    }

    async function handleClone() {
        try {
            const typeOverride = selectedType ? { type: selectedType } : {};
            await cloneAnnotationAndEntity(annotation, {
                entityLabel,
                newAnnotation: { ...newAnnotation, ...typeOverride },
            });
            handleClose();
        } catch (error) {
            console.error(error);
        }

    }

    function handleAnnotationTemplateChange(annotationTemplateId) {
        const annotationTemplate = annotationTemplates.find((t) => t.id === annotationTemplateId);
        const newAnnotationProps = getNewAnnotationPropsFromAnnotationTemplate(annotationTemplate);
        dispatch(setNewAnnotation({ ...newAnnotationProps }))
    }


    /// render

    return <DialogGeneric open={open} onClose={handleClose} width={300}>

        <BoxFlexVStretch>
            <Box sx={{ mb: 4 }}>


                <Typography variant="body2" color="text.secondary" sx={{ p: 1, pb: 2 }}>Choisir un nouveau modèle</Typography>
                <SelectorAnnotationTemplateVariantList
                    selectedAnnotationTemplateId={annotationTemplateId}
                    onChange={handleAnnotationTemplateChange}
                    annotationTemplates={annotationTemplates}
                />
            </Box>
            {typeOptions && (
                <Box sx={{ px: 1, pb: 2 }}>
                    <Typography variant="body2" sx={{ fontWeight: "bold", mb: 1 }}>
                        Type
                    </Typography>
                    <ToggleSingleSelectorGeneric
                        selectedKey={selectedType}
                        options={typeOptions}
                        onChange={(v) => setSelectedType(v ?? annotation?.type)}
                    />
                </Box>
            )}
            <FieldTextV2
                label="Libellé de l'ouvrage" value={entityLabel} onChange={setEntityLabel}
                options={{ showAsSection: true, fullWidth: true }}
            />
            <Box sx={{ p: 1, width: 1 }}>
                <FieldToggleFWC
                    value={fwc}
                    onChange={setFwc}
                />
            </Box>
        </BoxFlexVStretch>

        <ButtonInPanelV2 onClick={handleClone} label="Cloner" color="secondary" variant="contained" />


    </DialogGeneric>
}
