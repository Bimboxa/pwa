import {useDispatch} from "react-redux";

import {setOpenPanelSync} from "Features/sync/syncSlice";
import {setOpenPanelDownloadListingsData} from "../listingsConfigSlice";

import useDownloadScopeData from "Features/sync/hooks/useDownloadScopeData";

import {Typography} from "@mui/material";
import BoxFlexVStretch from "Features/layout/components/BoxFlexVStretch";
import BoxCenter from "Features/layout/components/BoxCenter";

import ButtonInPanel from "Features/layout/components/ButtonInPanel";

export default function PanelDownloadListingsData() {
  const dispatch = useDispatch();

  const description =
    "Téléchargez les données de la mission sur votre appareil. Vous pourrez ensuite les utiliser hors-ligne.";

  const label = "Télécharger";

  // data

  const downloadScopeData = useDownloadScopeData();

  // handler

  async function handleClick() {
    dispatch(setOpenPanelSync(true));
    await downloadScopeData();
    dispatch(setOpenPanelSync(false));
    dispatch(setOpenPanelDownloadListingsData(false));
  }

  return (
    <BoxFlexVStretch>
      <BoxFlexVStretch>
        <BoxCenter sx={{p: 2}}>
          <Typography sx={{whiteSpace: "pre-line"}} color="text.secondary">
            {description}
          </Typography>
        </BoxCenter>
      </BoxFlexVStretch>
      <ButtonInPanel label={label} onClick={handleClick} />
    </BoxFlexVStretch>
  );
}
