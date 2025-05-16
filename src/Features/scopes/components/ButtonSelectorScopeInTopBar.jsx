import {useState} from "react";

import {useSelector, useDispatch} from "react-redux";

import {setOpen} from "Features/scopeSelector/scopeSelectorSlice";

import useSelectedScope from "../hooks/useSelectedScope";
import useAppConfig from "Features/appConfig/hooks/useAppConfig";
import useUserEmail from "Features/auth/hooks/useUserEmail";
import useRemoteContainer from "Features/sync/hooks/useRemoteContainer";
import useSyncFilesToPush from "Features/sync/hooks/useSyncFilesToPush";

import {Box, Typography, Button, Badge} from "@mui/material";
import {ArrowDropDown as Down} from "@mui/icons-material";

import ScopeSelector from "Features/scopeSelector/components/ScopeSelector";
import ButtonMenuSyncIndicator from "Features/sync/components/ButtonMenuSyncIndicator";
import DialogFsOrMenu from "Features/layout/components/DialogFsOrMenu";

export default function ButtonSelectorScopeInTopBar() {
  const dispatch = useDispatch();
  // title

  const appConfig = useAppConfig();
  const title = appConfig?.strings?.general?.projectAndScope;
  const selectS = appConfig?.strings?.general?.select;

  // data

  const open = useSelector((s) => s.scopeSelector.open);
  const {value: userEmail} = useUserEmail();
  const syncFilesToPush = useSyncFilesToPush();
  const syncTasks = useSelector((s) => s.sync.syncTasks);

  // state

  const [anchorEl, setAnchorEl] = useState(null);

  // data

  const {value: scope} = useSelectedScope({withProject: true});
  console.log("[debug] scope", scope);

  // helpers

  const syncCounter = syncFilesToPush?.length + syncTasks?.length;

  const show = userEmail && userEmail.includes("@");

  //const projectName = scope?.project?.name;
  const scopeName = scope?.name ?? selectS;

  // handlers - dialog

  function handleDialogClose() {
    setAnchorEl(null);
    dispatch(setOpen(false));
  }

  function handleClick(e) {
    setAnchorEl(e.currentTarget);
    dispatch(setOpen(true));
  }

  if (!show) return <Box />;
  return (
    <>
      <Box sx={{alignItems: "center", display: "flex"}}>
        <Button
          onClick={handleClick}
          endIcon={<Down />}
          variant={scope?.name ? "text" : "contained"}
          color={scope?.name ? "secondary" : "secondary"}
        >
          <Typography variant="body2">{scopeName}</Typography>
        </Button>

        {syncCounter > 0 && <ButtonMenuSyncIndicator />}
      </Box>
    </>
  );
}
