import {
    Box,
} from "@mui/material";

import BoxFlexVStretch from "Features/layout/components/BoxFlexVStretch";

import FieldBaseMapAnnotations from "Features/baseMaps/components/FieldBaseMapAnnotations";
import FieldBaseMapShowEnhanced from "Features/baseMaps/components/FieldBaseMapShowEnhanced";

import SectionTitleGeneric from "Features/layout/components/SectionTitleGeneric";
import ButtonDialogDeleteBaseMap from "Features/baseMaps/components/ButtonDialogDeleteBaseMap";
import ButtonDownloadBaseMap from "Features/baseMaps/components/ButtonDownloadBaseMap";

export default function TabBaseMapInfo({ baseMap }) {

    return <BoxFlexVStretch>

        <SectionTitleGeneric title="Annotations" />
        <Box sx={{ bgcolor: "white", width: 1 }}>
            <FieldBaseMapAnnotations baseMap={baseMap} />
        </Box>

        <SectionTitleGeneric title="Image améliorée" sx={{ mt: 2 }} />
        <Box sx={{ bgcolor: "white", width: 1 }}>
            <ButtonDownloadBaseMap baseMap={baseMap} />
            <FieldBaseMapShowEnhanced baseMap={baseMap} />
        </Box>


        <SectionTitleGeneric title="Autres" sx={{ mt: 2 }} />
        <Box sx={{ bgcolor: "white", width: 1 }}>
            <ButtonDialogDeleteBaseMap baseMap={baseMap} />
        </Box>

    </BoxFlexVStretch>
}