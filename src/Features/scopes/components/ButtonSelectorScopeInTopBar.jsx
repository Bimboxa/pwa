import {useState} from "react";

import {useSelector, useDispatch} from "react-redux";

import {setOpen} from "Features/scopeSelector/scopeSelectorSlice";

import useSelectedScope from "../hooks/useSelectedScope";
import useAppConfig from "Features/appConfig/hooks/useAppConfig";

import {Box, Typography, Button} from "@mui/material";
import {ArrowDropDown as Down} from "@mui/icons-material";

import ScopeSelector from "Features/scopeSelector/components/ScopeSelector";
import ButtonMenuSyncIndicator from "Features/sync/components/ButtonMenuSyncIndicator";
import DialogFsOrMenu from "Features/layout/components/DialogFsOrMenu";

export default function ButtonSelectorScopeInTopBar() {
  const dispatch = useDispatch();
  // title

  const appConfig = useAppConfig();
  const title = appConfig?.strings?.general?.projectAndScope;

  // data

  const open = useSelector((s) => s.scopeSelector.open);

  // state

  const [anchorEl, setAnchorEl] = useState(null);

  // data

  const {value: scope} = useSelectedScope({withProject: true});

  // helpers

  //const projectName = scope?.project?.name;
  const scopeName = scope?.name ?? "-";

  // handlers - dialog

  function handleDialogClose() {
    setAnchorEl(null);
    dispatch(setOpen(false));
  }

  function handleClick(e) {
    setAnchorEl(e.currentTarget);
    dispatch(setOpen(true));
  }

  return (
    <>
      <Box sx={{alignItems: "center", display: "flex"}}>
        <Button onClick={handleClick} endIcon={<Down />}>
          <Box
            sx={{display: "flex", flexDirection: "column", alignItems: "start"}}
          >
            <Typography variant="body2">{scopeName}</Typography>
          </Box>
        </Button>
        <ButtonMenuSyncIndicator />
      </Box>
      <DialogFsOrMenu
        title={title}
        open={open}
        onClose={handleDialogClose}
        anchorEl={anchorEl}
      >
        <ScopeSelector />
      </DialogFsOrMenu>
    </>
  );
}
