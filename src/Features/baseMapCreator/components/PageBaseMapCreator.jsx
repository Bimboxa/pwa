import { useEffect } from "react"
import { useSelector, useDispatch } from "react-redux"

import { setPageNumber } from "Features/baseMapCreator/baseMapCreatorSlice"
import { setRotate, setPdfFile, setTempBaseMaps } from "Features/baseMapCreator/baseMapCreatorSlice"

import usePdfThumbnails from "Features/pdf/hooks/usePdfThumbnails"
import usePdfPageImageUrl from "../hooks/usePdfPageImageUrl"

// Ajout de Skeleton dans les imports
import { Box, Typography, Skeleton, IconButton } from "@mui/material"
import { RotateRight as Rotate } from "@mui/icons-material";

import BoxAlignToRight from "Features/layout/components/BoxAlignToRight"
import BoxFlexVStretch from "Features/layout/components/BoxFlexVStretch"
import IconButtonClose from "Features/layout/components/IconButtonClose"

import SelectorPdfPage from "./SelectorPdfPage"
import PdfImageEditor from "./PdfImageEditor"
import SectionPreviewBaseMaps from "./SectionPreviewBaseMaps"
import ButtonAddTempImage from "./ButtonAddTempImage"


export default function PageBaseMapCreator({ onClose }) {
    const dispatch = useDispatch();

    // data
    const { pdfFile } = useSelector((s) => s.baseMapCreator);
    const pageNumber = useSelector(s => s.baseMapCreator.pageNumber);
    const rotate = useSelector(s => s.baseMapCreator.rotate);

    // state
    const { thumbnails, error } = usePdfThumbnails(pdfFile);
    const imageUrl = usePdfPageImageUrl(pdfFile, pageNumber, rotate);

    console.log("thumbnails", thumbnails, error);


    // helpers
    const label = pdfFile ? pdfFile.name : "Selectionner un fichier PDF";

    // handlers
    function handlePageChange(pageNumber) {
        dispatch(setPageNumber(pageNumber));
    }

    async function handleRotate() {
        dispatch(setRotate(rotate + 90));
    }

    useEffect(() => {
        return () => {
            console.log("Unmounting PageBaseMapCreator");
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

                        <Box sx={{
                            p: 0.5,
                            bgcolor: "white",
                            visibility: imageUrl ? "visible" : "hidden",
                            display: "flex",
                            alignItems: "center",

                        }}>
                            <IconButton onClick={handleRotate}>
                                <Rotate />
                            </IconButton>
                            <ButtonAddTempImage pdfFile={pdfFile} pageNumber={pageNumber} />
                        </Box>

                        <Box sx={{
                            display: "flex", flexGrow: 1, flexDirection: "column",
                            minHeight: 0,
                        }}>
                            {imageUrl ? (
                                <PdfImageEditor imageUrl={imageUrl} />
                            ) : (
                                // Wrapper pour le padding
                                <Box sx={{ width: "100%", height: "100%", p: 4, boxSizing: "border-box" }}>
                                    <Skeleton
                                        variant="rectangular"
                                        width="100%"
                                        height="100%"
                                        animation="wave"
                                        sx={{ borderRadius: 1 }}
                                    />
                                </Box>
                            )}
                        </Box>



                    </Box>

                    {/* Colonne de droite : Aperçus */}
                    <Box sx={{
                        overflow: "auto", minWidth: 0, width: 250,
                        display: "flex", flexDirection: "column"
                    }}>
                        <SectionPreviewBaseMaps />
                    </Box>
                </Box>



            </BoxFlexVStretch>



        </BoxFlexVStretch>
    )
}