import { useState } from "react";
import { useSelector, useDispatch } from "react-redux";
import { nanoid } from "@reduxjs/toolkit";

import db from "App/db/db";

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
import useLogAppEvent from "Features/appLog/hooks/useLogAppEvent";

import { Box, CircularProgress, LinearProgress } from "@mui/material";

import ButtonGeneric from "Features/layout/components/ButtonGeneric";
import { setShowCreateBaseMapSection, setSelectedMainBaseMapId } from "Features/mapEditor/mapEditorSlice";
import { setCreatingInListingId } from "Features/baseMapEditor/baseMapEditorSlice";

import ensurePdfPageResources from "Features/resources/services/ensurePdfPageResourcesService";
import getDebugAuthFromLocalStorage from "Features/auth/services/getDebugAuthFromLocalStorage";

import renderTempBaseMapImage from "../utils/renderTempBaseMapImage";
import buildBaseMapNameForPage from "../utils/buildBaseMapNameForPage";
import computeBaseMapsPlacements from "../utils/computeBaseMapsPlacements";

export default function ButtonCreateBaseMaps({ pdfDocument, pdfFile }) {
    const dispatch = useDispatch();

    // data

    const createBaseMaps = useCreateBaseMaps();
    const linkBaseMapToContainer = useLinkBaseMapToContainer();
    const triggerInitialSaveIfNeeded = useTriggerInitialScopeSaveIfNeeded();
    const logAppEvent = useLogAppEvent();
    const tempBaseMaps = useSelector((s) => s.baseMapCreator.tempBaseMaps);
    const sourceContainerId = useSelector((s) => s.baseMapCreator.sourceContainerId);
    const pdfSourceResource = useSelector((s) => s.baseMapCreator.pdfSourceResource);
    const oneBaseMapPerPage = useSelector((s) => s.baseMapCreator.oneBaseMapPerPage);
    const blueprintScale = useSelector((s) => s.baseMapCreator.blueprintScale);
    const baseMapName = useSelector((s) => s.baseMapCreator.baseMapName);
    const creating = useSelector((s) => s.baseMapCreator.creating);
    const projectId = useSelector((s) => s.projects.selectedProjectId);
    const userProfile = useSelector((s) => s.auth.userProfile);

    // state

    const [progress, setProgress] = useState({ done: 0, total: 0 });

    // helpers

    // Build one temp base map per PDF page (full page, no crop), updating the
    // live preview and the progress bar as we go. The rotation handed to
    // pdfjs is absolute: use each page's intrinsic /Rotate so the render
    // matches the thumbnails / RESOURCES viewer (0 would ignore it).
    async function buildPerPageTempBaseMaps() {
        const total = pdfDocument?.numPages ?? 0;
        dispatch(setTempBaseMaps([]));
        setProgress({ done: 0, total });

        const temps = [];
        for (let page = 1; page <= total; page++) {
            const id = nanoid();
            const name = buildBaseMapNameForPage(baseMapName, page);
            dispatch(addTempBaseMap({ id, name }));

            let rotate = 0;
            try {
                rotate = (await pdfDocument.getPage(page)).rotate ?? 0;
            } catch (e) {
                console.warn("[baseMapCreator] intrinsic rotation unavailable", page, e);
            }

            const { imageFile, meterByPx, dpi } = await renderTempBaseMapImage({
                pdfFile,
                pdfDocument,
                page,
                bboxInRatio: null,
                rotate,
                blueprintScale,
                resolution: null, // AUTO
            });

            dispatch(updateTempBaseMap({ id, updates: { imageFile, name, meterByPx } }));
            temps.push({ id, name, imageFile, meterByPx, page, bboxInRatio: null, rotate, dpi });
            setProgress({ done: page, total });
        }
        return temps;
    }

    // Map(pageNumber -> resource) for a PDF_PAGE source resource (page 1 only),
    // null when the source is not such a resource or its row is gone.
    async function getPdfPageSourceResources() {
        if (pdfSourceResource?.kind !== "PDF_PAGE") return null;
        const resource = await db.resources.get(pdfSourceResource.id);
        if (!resource || resource.deletedAt) return null;
        return new Map([[1, resource]]);
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
            // Keep the source: each used PDF page is extracted into a
            // single-page PDF resource (deduped by content), so the base map
            // can be regenerated later (new crop / dpi) from the exact page.
            // When the source is already a PDF_PAGE resource (single-page PDF
            // picked from the project resources), reuse it as is: hashing its
            // bytes would yield a new sourceKey and duplicate the resource.
            const debugAuth = getDebugAuthFromLocalStorage();
            const pageResources =
                (await getPdfPageSourceResources()) ??
                (await ensurePdfPageResources({
                    pdfFile,
                    pdfDocument,
                    pageNumbers: baseMapsToCreate.map((bm) => bm.page).filter((p) => p != null),
                    projectId,
                    createdBy: {
                        idMaster: userProfile?.idMaster ?? debugAuth?.userIdMaster ?? null,
                        trigram: userProfile?.trigram ?? debugAuth?.trigram ?? null,
                    },
                }));

            const baseMapsWithPlacement = baseMapsToCreate.map((bm) => {
                const placement = placements.get(bm.id);
                const next = placement ? { ...bm, ...placement } : { ...bm };
                // PDF provenance (page + crop + dpi), persisted on the record
                // so the render can be replayed from the stored page later.
                // Skipped for non-PDF temp images (no page).
                if (bm.page != null) {
                    const resource = pageResources.get(bm.page) ?? null;
                    next.createdFrom = {
                        type: "PDF_PAGE",
                        // The resource is single-page: pageNumber is the page
                        // IN the resource (contract of renderDetailBaseMapImage
                        // / getFolioAnnotationsRect), sourcePageNumber the page
                        // in the original PDF (display only). pdfFileName =
                        // resource name so resolveDetailResource's name
                        // fallback finds it after a re-import.
                        pdfFileName: resource?.name ?? pdfFile?.name ?? null,
                        resourceId: resource?.id ?? null,
                        pageNumber: resource ? 1 : bm.page,
                        sourcePageNumber: bm.page,
                        rotation: bm.rotate ?? 0,
                        bboxInRatio: bm.bboxInRatio ?? null,
                        dpi: bm.dpi ?? null,
                        blueprintScale: blueprintScale || null,
                    };
                }
                return next;
            });

            const baseMaps = await createBaseMaps(baseMapsWithPlacement);

            baseMapsToCreate.forEach((bm) => {
                logAppEvent("BASE_MAP_CREATED", {
                    name: bm.name,
                    source: "pdf",
                    size: bm.imageFile?.size,
                });
            });

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
            dispatch(setCreatingInListingId(null));
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
