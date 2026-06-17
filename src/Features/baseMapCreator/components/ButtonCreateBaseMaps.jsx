import { useState } from "react";
import { useSelector, useDispatch } from "react-redux";
import { nanoid } from "@reduxjs/toolkit";

import {
    setOpenBaseMapCreator,
    clearSourceContainer,
    setCreating,
    setTempBaseMaps,
    addTempBaseMap,
    updateTempBaseMap,
} from "../baseMapCreatorSlice";

import useCreateBaseMaps from "../hooks/useCreateBaseMaps";
import useLinkBaseMapToContainer from "../hooks/useLinkBaseMapToContainer";
import useTriggerInitialScopeSaveIfNeeded from "Features/remoteScopeConfigurations/hooks/useTriggerInitialScopeSaveIfNeeded";

import { Box, CircularProgress, LinearProgress } from "@mui/material";

import ButtonGeneric from "Features/layout/components/ButtonGeneric";
import { setShowCreateBaseMapSection, setSelectedMainBaseMapId } from "Features/mapEditor/mapEditorSlice";

import renderTempBaseMapImage from "../utils/renderTempBaseMapImage";
import buildBaseMapNameForPage from "../utils/buildBaseMapNameForPage";
import computeBaseMapsPlacements from "../utils/computeBaseMapsPlacements";

export default function ButtonCreateBaseMaps({ pdfDocument, pdfFile }) {
    const dispatch = useDispatch();

    // data

    const createBaseMaps = useCreateBaseMaps();
    const linkBaseMapToContainer = useLinkBaseMapToContainer();
    const triggerInitialSaveIfNeeded = useTriggerInitialScopeSaveIfNeeded();
    const tempBaseMaps = useSelector((s) => s.baseMapCreator.tempBaseMaps);
    const sourceContainerId = useSelector((s) => s.baseMapCreator.sourceContainerId);
    const oneBaseMapPerPage = useSelector((s) => s.baseMapCreator.oneBaseMapPerPage);
    const blueprintScale = useSelector((s) => s.baseMapCreator.blueprintScale);
    const baseMapName = useSelector((s) => s.baseMapCreator.baseMapName);
    const creating = useSelector((s) => s.baseMapCreator.creating);

    // state

    const [progress, setProgress] = useState({ done: 0, total: 0 });

    // helpers

    // Build one temp base map per PDF page (full page, no crop / no rotation),
    // updating the live preview and the progress bar as we go.
    async function buildPerPageTempBaseMaps() {
        const total = pdfDocument?.numPages ?? 0;
        dispatch(setTempBaseMaps([]));
        setProgress({ done: 0, total });

        const temps = [];
        for (let page = 1; page <= total; page++) {
            const id = nanoid();
            const name = buildBaseMapNameForPage(baseMapName, page);
            dispatch(addTempBaseMap({ id, name }));

            const { imageFile, meterByPx } = await renderTempBaseMapImage({
                pdfFile,
                pdfDocument,
                page,
                bboxInRatio: null,
                rotate: 0,
                blueprintScale,
                resolution: null, // AUTO
            });

            dispatch(updateTempBaseMap({ id, updates: { imageFile, name, meterByPx } }));
            temps.push({ id, name, imageFile, meterByPx, page, bboxInRatio: null, rotate: 0 });
            setProgress({ done: page, total });
        }
        return temps;
    }

    // handlers

    async function handleCreateClick() {
        dispatch(setCreating(true));
        try {
            const baseMapsToCreate = oneBaseMapPerPage
                ? await buildPerPageTempBaseMaps()
                : tempBaseMaps;

            // Compute each baseMap's 3D placement from its crop on the PDF page
            // (same page => first crop is the reference at the world origin),
            // so the user does not have to position them manually afterwards.
            const placements = await computeBaseMapsPlacements({
                baseMaps: baseMapsToCreate,
                pdfDocument,
                blueprintScale,
            });
            const baseMapsWithPlacement = baseMapsToCreate.map((bm) => {
                const placement = placements.get(bm.id);
                return placement ? { ...bm, ...placement } : bm;
            });

            const baseMaps = await createBaseMaps(baseMapsWithPlacement);

            const baseMap0 = baseMaps?.[0];
            if (baseMap0) {
                dispatch(setSelectedMainBaseMapId(baseMap0.id));
            }

            if (sourceContainerId && baseMap0) {
                await linkBaseMapToContainer(baseMap0.id);
                dispatch(clearSourceContainer());
            }

            if (baseMaps?.length) triggerInitialSaveIfNeeded();

            dispatch(setCreating(false));
            dispatch(setOpenBaseMapCreator(false));
            dispatch(setShowCreateBaseMapSection(false));
        } catch (error) {
            console.error("Erreur lors de la création des fonds de plan :", error);
            dispatch(setCreating(false));
        }
    }

    // helpers - label & disabled

    const pageCount = pdfDocument?.numPages ?? 0;
    const count = oneBaseMapPerPage ? pageCount : tempBaseMaps.length;
    const disabled = creating || count === 0;

    let label;
    if (creating) {
        label = progress.total > 0
            ? `Création… (${progress.done}/${progress.total})`
            : "Création…";
    } else {
        label = count > 0
            ? `Créer les fonds de plans (${count})`
            : "Créer les fonds de plans";
    }

    const progressPct =
        progress.total > 0 ? Math.round((progress.done / progress.total) * 100) : 0;

    // render

    return (
        <Box sx={{ width: 1 }}>
            <ButtonGeneric
                size="large"
                fullWidth
                label={label}
                onClick={handleCreateClick}
                variant="contained"
                color="primary"
                disabled={disabled}
                startIcon={creating ? <CircularProgress size={16} color="inherit" /> : null}
            />
            {creating && progress.total > 0 && (
                <Box sx={{ mt: 0.75 }}>
                    <LinearProgress variant="determinate" value={progressPct} />
                </Box>
            )}
        </Box>
    );
}
