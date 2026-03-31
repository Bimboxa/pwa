import { useRef, useCallback } from "react";

import { useDispatch } from "react-redux";

import useSelectedEntity from "../hooks/useSelectedEntity";
import useEntityFormTemplate from "../hooks/useEntityFormTemplate";
import useUpdateEntity from "../hooks/useUpdateEntity";


import { triggerSelectionBack } from "Features/selection/selectionSlice";

import { Box, Typography, IconButton } from "@mui/material";
import { ArrowBack as Back } from "@mui/icons-material";

import BoxFlexVStretch from "Features/layout/components/BoxFlexVStretch";
import SectionEntityAnnotations from "./SectionEntityAnnotations";

import FormEntity from "./FormEntity";

const ENTITY_UPDATE_DELAY = 500;

export default function PanelEntityProperties() {

    const containerRef = useRef();
    const updateTimerRef = useRef(null);

    const dispatch = useDispatch();

    // data

    const { value: entity } = useSelectedEntity({ withImages: true, withAnnotations: true });
    const template = useEntityFormTemplate();
    const updateEntity = useUpdateEntity();

    // helper

    const label = "Objet";

    // handlers

    // eslint-disable-next-line react-hooks/exhaustive-deps
    const handleEntityChange = useCallback((entity) => {
        clearTimeout(updateTimerRef.current);
        updateTimerRef.current = setTimeout(() => {
            updateEntity(entity?.id, entity);
        }, ENTITY_UPDATE_DELAY);
    }, [updateEntity]);

    return (
        <BoxFlexVStretch ref={containerRef} sx={{ p: 1, position: "relative" }}>

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


            </Box>
            <BoxFlexVStretch sx={{ overflow: "auto" }}>

                <FormEntity
                    template={template}
                    entity={entity}
                    onEntityChange={handleEntityChange}
                    sectionContainerEl={containerRef?.current}
                />

                {entity?.annotations?.length > 0 && <Box sx={{ py: 1 }}><SectionEntityAnnotations
                    entity={entity}
                /></Box>}

            </BoxFlexVStretch>
        </BoxFlexVStretch>

    );
}