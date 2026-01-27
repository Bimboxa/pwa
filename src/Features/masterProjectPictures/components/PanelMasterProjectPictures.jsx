import useAppConfig from "Features/appConfig/hooks/useAppConfig";
import useInitFetchMasterProjectPictures from "../hooks/useInitFetchMasterProjectPictures";

import { Typography, Box } from "@mui/material";

import BoxFlexVStretch from "Features/layout/components/BoxFlexVStretch";

import ImagesGridMasterProjectPictures from "./ImagesGridMasterProjectPictures";
import IconButtonFetchMasterProjectPictures from "./IconButtonFetchMasterProjectPictures";

export default function PanelMasterProjectPictures() {

    // data

    const appConfig = useAppConfig();

    // helper - title

    const title = appConfig.features?.masterProjectPictures?.title;

    // hooks

    useInitFetchMasterProjectPictures();

    // return

    return <BoxFlexVStretch>
        <Box sx={{ p: 1, alignItems: "center", display: "flex", justifyContent: "space-between" }}>
            <Typography >{title}</Typography>
            <IconButtonFetchMasterProjectPictures />
        </Box>
        <BoxFlexVStretch sx={{ overflow: "auto" }}>
            <ImagesGridMasterProjectPictures />
        </BoxFlexVStretch>

    </BoxFlexVStretch>
}