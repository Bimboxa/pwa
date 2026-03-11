
import { useSelector } from "react-redux";

import useMainBaseMap from "../hooks/useMainBaseMap";
import useSelectedListing from "Features/listings/hooks/useSelectedListing";

import { Paper, Box } from "@mui/material";

import FieldNewAnnotationLabel from "./FieldNewAnnotationLabel";
import FieldNewAnnotationColor from "./FieldNewAnnotationColor";


import ButtonDrawMarker from "./ButtonDrawMarker";
import ButtonDrawPolygon from "./ButtonDrawPolygon";
import ButtonDrawPolyline from "./ButtonDrawPolyline";
import ButtonDrawLabel from "./ButtonDrawLabel";
import ButtonEditScale from "./ButtonEditScale";
import ButtonDrawStrip from "./ButtonDrawStrip";

import ToolbarEnabledDrawingMode from "./ToolbarEnabledDrawingMode";


export default function ToolbarMapEditorV3() {


    // data

    const enabledDrawingMode = useSelector((s) => s.mapEditor.enabledDrawingMode);
    const baseMap = useMainBaseMap();
    const meterByPx = baseMap?.meterByPx;
    const newAnnotation = useSelector((s) => s.annotations.newAnnotation);
    const openedPanel = useSelector(s => s.listings.openedPanel)
    const { value: listing } = useSelectedListing();

    // helper

    const isBaseMapAnnotation = openedPanel === "BASE_MAP_DETAIL";
    //const disabled = !newAnnotation?.label && !isBaseMapAnnotation;
    const disabled = false;

    // helpers

    const tools = [
        <ButtonDrawLabel key={0} disabled={disabled} />,
        <ButtonDrawMarker key={1} disabled={disabled} />,
        <ButtonDrawPolyline key={2} disabled={disabled} />,
        <ButtonDrawPolygon key={3} disabled={disabled} />,
        <ButtonDrawStrip key={4} disabled={disabled} />,
    ]

    // helpers - show

    const showTools = openedPanel === "BASE_MAP_DETAIL" || listing?.showNewAnnotationToolbar;

    // render

    if (enabledDrawingMode) {
        return <Box sx={{ display: "flex", gap: 1 }}>
            <ToolbarEnabledDrawingMode />

        </Box>
    }

    return <Box sx={{ display: "flex", gap: 1 }}>
        {showTools && <Paper sx={{ display: "flex", alignItems: "center", p: 0.5, pr: 1, borderRadius: 2 }}>
            <Box sx={{ display: "flex", gap: 0.5, alignItems: "center" }}>


                <Box sx={{ minWidth: 100 }}>
                    <FieldNewAnnotationLabel />
                </Box>

                <FieldNewAnnotationColor />
            </Box>

            <Box sx={{ display: "flex", gap: 0.5, ml: 2, minWidth: 0 }}>
                {tools.map(tool => tool)}
            </Box>

        </Paper >}

        {meterByPx && < Paper sx={{ display: "flex", alignItems: "center", p: 0.5, px: 1, borderRadius: 2 }}>
            <ButtonEditScale />
        </Paper>

        }
    </Box >
}