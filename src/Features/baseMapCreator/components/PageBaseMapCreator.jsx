import { useEffect, useState } from "react"
import { useSelector, useDispatch } from "react-redux"

import { setPageNumber } from "Features/baseMapCreator/baseMapCreatorSlice"
import { setRotate, setPdfFile, setTempBaseMaps } from "Features/baseMapCreator/baseMapCreatorSlice"

import usePdfDocument from "Features/pdf/hooks/usePdfDocument"
import usePdfThumbnails from "Features/pdf/hooks/usePdfThumbnails"
import usePdfPageImageUrl from "../hooks/usePdfPageImageUrl"

// Ajout de Skeleton dans les imports
import { Box, Typography, Skeleton, IconButton, Chip, CircularProgress, LinearProgress } from "@mui/material"
import { Rotate90DegreesCcw as RotateCcw, Rotate90DegreesCw as RotateCw } from "@mui/icons-material";

import BoxAlignToRight from "Features/layout/components/BoxAlignToRight"
import BoxFlexVStretch from "Features/layout/components/BoxFlexVStretch"
import IconButtonClose from "Features/layout/components/IconButtonClose"

import SelectorPdfPage from "./SelectorPdfPage"
import PdfImageEditor from "./PdfImageEditor"
import SectionPreviewBaseMaps from "./SectionPreviewBaseMaps"
import ButtonAddTempImage from "./ButtonAddTempImage"
import FieldTextV2 from "Features/form/components/FieldTextV2"


export default function PageBaseMapCreator({ onClose }) {
    const dispatch = useDispatch();

    // data
    const { pdfFile } = useSelector((s) => s.baseMapCreator);
    const pageNumber = useSelector(s => s.baseMapCreator.pageNumber);
    const rotate = useSelector(s => s.baseMapCreator.rotate);

    // state
    const { pdfDocument, error: pdfError, progress: pdfProgress } = usePdfDocument(pdfFile);
    const { thumbnails, error } = usePdfThumbnails(pdfDocument, pageNumber);
    const { imageUrl, isUpgrading } = usePdfPageImageUrl(pdfDocument, pageNumber, rotate);
    const sourceKey = `${pageNumber}_${rotate}`;

    // Use the page thumbnail (200 px JPEG, generated for the left panel) as
    // an immediate fallback while the editor-quality render (36 → 72 DPI) is
    // still in flight. Avoids the long gray-Skeleton gap on heavy vector PDFs.
    const pageThumbnailUrl = thumbnails[pageNumber - 1]?.imageUrl ?? null;
    const displayImageUrl = imageUrl ?? pageThumbnailUrl;
    const isThumbnailFallback = !imageUrl && Boolean(pageThumbnailUrl);

    const isParsingPdf = Boolean(pdfFile) && !pdfDocument && !pdfError;
    const isPreparingPage = Boolean(pdfDocument) && !displayImageUrl && !pdfError;
    const pdfProgressPct =
        pdfProgress && pdfProgress.total > 0
            ? Math.min(100, Math.round((pdfProgress.loaded / pdfProgress.total) * 100))
            : null;

    const [blueprintScale, setBlueprintScale] = useState("");


    // helpers
    const label = pdfFile ? pdfFile.name : "Selectionner un fichier PDF";

    // handlers
    function handlePageChange(pageNumber) {
        dispatch(setPageNumber(pageNumber));
    }

    async function handleRotate({ counter }) {
        dispatch(setRotate(rotate + (counter ? -90 : 90)));
    }

    useEffect(() => {
        return () => {
            dispatch(setRotate(0));
            dispatch(setPageNumber(1));
            //dispatch(setPdfFile(null));
            dispatch(setTempBaseMaps([]));
        }
    }, [])

    return (
        <BoxFlexVStretch sx={{ width: 1 }}>
            <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", p: 0.5 }}>
                <Typography variant="h6">{label}</Typography>
                <IconButtonClose onClose={onClose} />
            </Box>


            <BoxFlexVStretch>
                <Box sx={{ display: "flex", width: 1, height: 1 }}>
                    {/* Colonne de gauche : Miniatures */}
                    <Box sx={{ overflow: "auto", minWidth: 0, width: 150 }}>
                        <SelectorPdfPage pageNumber={pageNumber} thumbnails={thumbnails} onPageNumberChange={handlePageChange} />
                    </Box>

                    {/* Zone centrale : Editeur ou Skeleton */}
                    <Box sx={{
                        flex: 1, minWidth: 0, minHeight: 0,
                        display: "flex", flexDirection: "column",
                        position: "relative",
                    }}>

                        {/* Indicateur d'upgrade — toujours monté pour ne pas
                            déclencher de reflow dans le conteneur mesuré par
                            PdfImageEditor. Visibilité pilotée par opacity. */}
                        <Chip
                            icon={<CircularProgress size={14} />}
                            label="Amélioration de la qualité…"
                            size="small"
                            sx={{
                                position: "absolute",
                                top: 56,
                                right: 8,
                                zIndex: 3,
                                bgcolor: "rgba(255,255,255,0.92)",
                                opacity: displayImageUrl && (isUpgrading || isThumbnailFallback) ? 1 : 0,
                                pointerEvents: displayImageUrl && (isUpgrading || isThumbnailFallback) ? "auto" : "none",
                                transition: "opacity 150ms ease",
                            }}
                        />

                        <Box sx={{
                            p: 0.5,
                            bgcolor: "white",
                            visibility: imageUrl ? "visible" : "hidden",
                            display: "flex",
                            alignItems: "center",

                        }}>
                            <IconButton onClick={() => handleRotate({ counter: false })}>
                                <RotateCw />
                            </IconButton>
                            <IconButton onClick={() => handleRotate({ counter: true })}>
                                <RotateCcw />
                            </IconButton>
                            <Box sx={{ width: 140, minWidth: 140, display: "flex", alignItems: "center" }}>
                                <FieldTextV2
                                    value={blueprintScale}
                                    onChange={setBlueprintScale}
                                    label="Echelle"
                                    options={{
                                        showLabel: true,
                                        fullWidth: true,
                                        showAsLabelAndValue: true,
                                        startAdornment: "1 :",
                                    }}
                                />
                            </Box>
                            <ButtonAddTempImage pdfFile={pdfFile} pdfDocument={pdfDocument} blueprintScale={blueprintScale} />
                        </Box>

                        <Box sx={{
                            display: "flex", flexGrow: 1, flexDirection: "column",
                            minHeight: 0,
                            position: "relative",
                        }}>
                            {displayImageUrl ? (
                                <PdfImageEditor imageUrl={displayImageUrl} sourceKey={sourceKey} />
                            ) : (
                                <Box sx={{
                                    width: "100%", height: "100%", p: 4, boxSizing: "border-box",
                                    position: "relative",
                                }}>
                                    <Skeleton
                                        variant="rectangular"
                                        width="100%"
                                        height="100%"
                                        animation="wave"
                                        sx={{ borderRadius: 1 }}
                                    />
                                    {(isParsingPdf || isPreparingPage) && (
                                        <Box sx={{
                                            position: "absolute",
                                            inset: 0,
                                            display: "flex",
                                            flexDirection: "column",
                                            alignItems: "center",
                                            justifyContent: "center",
                                            gap: 1.5,
                                            color: "text.secondary",
                                        }}>
                                            <CircularProgress size={32} />
                                            <Typography variant="body2">
                                                {isParsingPdf
                                                    ? `Chargement du PDF…${pdfProgressPct !== null ? ` ${pdfProgressPct}%` : ""}`
                                                    : `Rendu de la page ${pageNumber}…`}
                                            </Typography>
                                            {isParsingPdf && pdfProgressPct !== null && (
                                                <Box sx={{ width: 220 }}>
                                                    <LinearProgress
                                                        variant="determinate"
                                                        value={pdfProgressPct}
                                                    />
                                                </Box>
                                            )}
                                        </Box>
                                    )}
                                    {pdfError && (
                                        <Box sx={{
                                            position: "absolute",
                                            inset: 0,
                                            display: "flex",
                                            alignItems: "center",
                                            justifyContent: "center",
                                            color: "error.main",
                                        }}>
                                            <Typography variant="body2">
                                                Erreur de chargement du PDF
                                            </Typography>
                                        </Box>
                                    )}
                                </Box>
                            )}
                        </Box>



                    </Box>

                    {/* Colonne de droite : Aperçus */}
                    <Box sx={{
                        overflow: "auto", minWidth: 0, width: 200,
                        display: "flex", flexDirection: "column"
                    }}>
                        <SectionPreviewBaseMaps />
                    </Box>
                </Box>



            </BoxFlexVStretch>



        </BoxFlexVStretch>
    )
}