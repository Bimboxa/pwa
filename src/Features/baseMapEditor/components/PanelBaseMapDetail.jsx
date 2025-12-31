import useMainBaseMap from "Features/mapEditor/hooks/useMainBaseMap";

import { Box, Typography } from "@mui/material";

import BoxFlexVStretch from "Features/layout/components/BoxFlexVStretch";
import HeaderBaseMapDetail from "./HeaderBaseMapDetail";
import SectionBaseMapEditorTabs from "./SectionBaseMapEditorTabs";

export default function BaseMapDetail() {

    // data

    const baseMap = useMainBaseMap();

    // helpers

    const name = baseMap?.name || "Sélectionner une carte";

    // render

    return (
        <BoxFlexVStretch>
            <HeaderBaseMapDetail baseMap={baseMap} />
            <SectionBaseMapEditorTabs />
        </BoxFlexVStretch>
    );
}