import {useEffect} from "react";
import useSyncFilesToPush from "../hooks/useSyncFilesToPush";
import useUploadChanges from "../hooks/useUploadChanges";

import {List, ListItem, ListItemText, Box, Typography} from "@mui/material";

import BoxFlexVStretch from "Features/layout/components/BoxFlexVStretch";
import ButtonInPanel from "Features/layout/components/ButtonInPanel";
import computeSyncScopeFromSyncFiles from "../services/computeSyncScopeFromSyncFiles";
import SectionUpToDate from "./SectionUpToDate";

export default function SectionSyncFilesToPush() {
  // strings

  const syncS = "Synchroniser";

  // data

  const syncFilesToPush = useSyncFilesToPush();
  const uploadChanges = useUploadChanges();

  // effect - auto trigger

  // useEffect(() => {
  //   if (syncFilesToPush?.length > 0) uploadChangesAsync();
  // }, []);

  // helpers

  const isUpToDate = syncFilesToPush?.length === 0;

  // handlers

  async function handleClick() {
    try {
      await uploadChanges();
      //dispatch(setOpenPanelSync(false));
    } catch (e) {
      console.log("error", e);
      dispatch(setOpenPanelSync(false));
    }
  }

  return (
    <BoxFlexVStretch>
      <BoxFlexVStretch sx={{overflow: "auto"}}>
        {isUpToDate && <SectionUpToDate />}
        <List dense sx={{width: 1}}>
          {syncFilesToPush.map((item) => {
            return (
              <ListItem key={item.path} divider sx={{display: "flex"}}>
                <Box sx={{display: "flex", width: 1}}>
                  <Typography variant="caption" sx={{flexWrap: "wrap"}}>
                    {item.path}
                  </Typography>
                </Box>
              </ListItem>
            );
          })}
        </List>
      </BoxFlexVStretch>
      <ButtonInPanel
        label={syncS}
        onClick={handleClick}
        disabled={isUpToDate}
      />
    </BoxFlexVStretch>
  );
}
