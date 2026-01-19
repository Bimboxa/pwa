import {
    Box,
} from "@mui/material";

import BoxFlexVStretch from "Features/layout/components/BoxFlexVStretch";

import FieldBaseMapAnnotations from "Features/baseMaps/components/FieldBaseMapAnnotations";
import FieldBaseMapEnhancedImage from "Features/baseMaps/components/FieldBaseMapEnhancedImage";
import FieldBaseMapShowEnhanced from "Features/baseMaps/components/FieldBaseMapShowEnhanced";
import FieldBaseMapScale from "Features/baseMaps/components/FieldBaseMapScale";

import SectionTitleGeneric from "Features/layout/components/SectionTitleGeneric";
import ButtonDialogDeleteBaseMap from "Features/baseMaps/components/ButtonDialogDeleteBaseMap";
import ButtonDownloadBaseMap from "Features/baseMaps/components/ButtonDownloadBaseMap";
import ToolSetEnhancedAsMain from "./ToolSetEnhancedAsMain";
import SectionBaseMapSizeInfo from "Features/baseMaps/components/SectionBaseMapSizeInfo";
import FieldBaseMapOpacity from "Features/baseMaps/components/FieldBaseMapOpacity";

export default function TabBaseMapInfo({ baseMap }) {

    return <BoxFlexVStretch>

        <SectionTitleGeneric title="Général" />
        <Box sx={{ bgcolor: "white", width: 1 }}>
            <SectionBaseMapSizeInfo baseMap={baseMap} />
            <FieldBaseMapScale baseMap={baseMap} />
        </Box>

        <SectionTitleGeneric title="Image améliorée" sx={{ mt: 2 }} />
        <Box sx={{ bgcolor: "white", width: 1 }}>
            <FieldBaseMapEnhancedImage baseMap={baseMap} />
            <ToolSetEnhancedAsMain baseMap={baseMap} />
            <FieldBaseMapShowEnhanced baseMap={baseMap} />
            {baseMap?.showEnhanced && <FieldBaseMapOpacity baseMap={baseMap} variant="imageEnhanced" />}
        </Box>


        <SectionTitleGeneric title="Autres" sx={{ mt: 2 }} />
        <Box sx={{ bgcolor: "white", width: 1 }}>
            <FieldBaseMapAnnotations baseMap={baseMap} />
            <ButtonDialogDeleteBaseMap baseMap={baseMap} />
            <ButtonDownloadBaseMap baseMap={baseMap} />
        </Box>

    </BoxFlexVStretch>
}