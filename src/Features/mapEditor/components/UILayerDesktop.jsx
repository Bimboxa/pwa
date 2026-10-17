import { useState } from "react";
import { useSelector } from "react-redux";

import useSelectedListing from "Features/listings/hooks/useSelectedListing";
import { useInteraction } from "../context/InteractionContext";

import { Box, Button } from "@mui/material";
import { GpsFixed } from "@mui/icons-material";

import ButtonEditScaleVariantFirst from "./ButtonEditScaleVariantFirst";
import ButtonAutoLayoutLabels from "Features/tools/components/ButtonAutoLayoutLabels";
import ButtonRunningTransform from "Features/baseMapTransforms/components/ButtonRunningTransform";
import SelectorMapEditorMode from "./SelectorMapEditorMode";
import SelectorOrthoSnap from "./SelectorOrthoSnap";
import ButtonToggleCursorAltitude from "./ButtonToggleCursorAltitude";
import SelectorDrawingPanel from "./SelectorDrawingPanel";
import DialogCalibration2D from "./DialogCalibration2D";
import ButtonToggleThreedViewer from "Features/viewers/components/ButtonToggleThreedViewer";
import ButtonZoomOutMap from "./ButtonZoomOutMap";


export default function UILayerDesktop({
    mapController,
    onResetCamera,
    viewport,
    isActiveViewer,
}) {

    // data

    const { value: listing } = useSelectedListing();
    const openedPanel = useSelector(s => s.listings.openedPanel);
    const viewerKey = useSelector(s => s.viewers.selectedViewerKey);
    const showCalibration = useSelector(s => s.baseMapEditor.showCalibration);

    const panelKey = useSelector(s => s.rightPanel.selectedMenuItemKey);
    const panelWidth = useSelector(s => s.rightPanel.width);
    const panelOpen = Boolean(panelKey);

    const { basePose } = useInteraction();

    const isBaseMapsViewer = viewerKey === "BASE_MAPS";

    // state

    const [openCalibrationDialog, setOpenCalibrationDialog] = useState(false);

    // helpers

    const emType = listing?.entityModel?.type;

    // helpers - show

    const showEditScale = true;

    return (
        <>
            {/* BaseMapSelector moved to TopBarDesktop for both MAP and BASE_MAPS viewers */}

            <Box
                data-capture-hide
                sx={{
                    position: "absolute",
                    left: "8px",
                    top: "8px",
                    zIndex: 1,
                    display: "flex",
                    alignItems: "center",
                    gap: 1,
                }}
            >
                <ButtonRunningTransform />
            </Box>

            {/* ToolbarMapEditorV3 removed — harmonize icon buttons (#67) */}

            {showEditScale && <Box
                data-capture-hide
                sx={{
                    position: "absolute",
                    left: "16px",
                    bottom: "16px",
                    zIndex: 1,
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "flex-start",
                    gap: 1,
                }}
            >
                <ButtonToggleCursorAltitude />
                <SelectorOrthoSnap />
                <ButtonEditScaleVariantFirst size="small" />
            </Box>}

            {/* <Box
                sx={{
                    position: "absolute",
                    right: "4px",
                    top: "4px",
                    zIndex: 1,
                    display: "flex",
                    alignItems: "center",
                }}
            >
                <ButtonAutoLayoutLabels basePose={basePose} />
            </Box> */}



            <Box
                data-capture-hide
                sx={{
                    position: "absolute",
                    right: panelOpen ? `${panelWidth + 16}px` : "16px",
                    bottom: "16px",
                    zIndex: 1,
                    display: "flex",
                    alignItems: "center",
                    // room for the Z badge of the zoom out and the T badge
                    // of the toggle, which face each other
                    gap: 2.5,
                    transition: "right 0.2s ease",
                }}
            >
                {/* Zoom out + 2D/3D toggle, same row as in the 3D editor. The
                    base map image mode and the base maps grid button live in
                    the bottom bar (SectionBaseMapsBottomBarControls); the 2D
                    editor settings in the right-panel SETTINGS tool, the
                    clipping-plane toggle in its "Plan de coupes" section,
                    SelectorOrthoSnap in the bottom-left cluster. */}
                <ButtonZoomOutMap
                    onResetCamera={onResetCamera}
                    isActiveViewer={isActiveViewer}
                    shortcutPlacement="top"
                />
                <ButtonToggleThreedViewer />
                {/* "Modification rapide des points" (QUICK_POINTS_CHANGE) is now
                    automatically active when PopperMapListings is in DRAW mode,
                    so this manual toggle is no longer needed. Kept commented for
                    historical reference. */}
                {/* <SelectorMapEditorMode /> */}
            </Box>

        </>
    );
}
