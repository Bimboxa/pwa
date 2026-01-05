import { useSelector } from "react-redux";
import useMainBaseMap from "Features/mapEditor/hooks/useMainBaseMap";

import { Box, Typography } from "@mui/material";

import BoxFlexVStretch from "Features/layout/components/BoxFlexVStretch";
import HeaderBaseMapDetail from "./HeaderBaseMapDetail";
import SectionBaseMapEditorTabs from "./SectionBaseMapEditorTabs";
import TabBaseMapInfo from "./TabBaseMapInfo";
import TabBaseMapAnnotations from "./TabBaseMapAnnotations";
import TabBaseMapTools from "./TabBaseMapTools";

export default function BaseMapDetail() {

    // data

    const baseMap = useMainBaseMap();
    const tab = useSelector((s) => s.baseMapEditor.selectedTab);

    // helpers

    const name = baseMap?.name || "Sélectionner une carte";

    // render

    return (
        <BoxFlexVStretch>
            <HeaderBaseMapDetail baseMap={baseMap} />
            <SectionBaseMapEditorTabs />
            <BoxFlexVStretch sx={{ pt: 2 }}>
                {tab === "INFO" && <TabBaseMapInfo baseMap={baseMap} />}
                {tab === "ANNOTATIONS" && <TabBaseMapAnnotations baseMap={baseMap} />}
                {tab === "TOOLS" && <TabBaseMapTools baseMap={baseMap} />}
            </BoxFlexVStretch>

        </BoxFlexVStretch>
    );
}