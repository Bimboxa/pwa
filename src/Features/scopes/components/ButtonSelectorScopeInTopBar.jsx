import {useState} from "react";

import {useSelector} from "react-redux";

import useScope from "../hooks/useScope";

import {Box, Typography, Button, Dialog, Menu} from "@mui/material";
import {ArrowDropDown as Down} from "@mui/icons-material";

import ScopeSelector from "Features/scopeSelector/components/ScopeSelector";

export default function ButtonSelectorScopeInTopBar() {
  // state

  //const [open, setOpen] = useState(false);
  const [anchorEl, setAnchorEl] = useState(null);
  const open = Boolean(anchorEl);

  // data

  const deviceType = useSelector((state) => state.layout.deviceType);
  const scope = useScope({withProject: true});

  // helpers

  const projectName = scope?.project?.name;
  const scopeName = scope?.name ?? "-";

  const isMobile = deviceType === "mobile";

  // handlers - dialog

  function handleClick(e) {
    setAnchorEl(e.currentTarget);
  }

  return (
    <>
      <Button onClick={handleClick} endIcon={<Down />}>
        <Box
          sx={{display: "flex", flexDirection: "column", alignItems: "start"}}
        >
          <Typography variant="body2">{scopeName}</Typography>
        </Box>
      </Button>
      {isMobile && (
        <Dialog
          open={open}
          onClose={() => setAnchorEl(null)}
          fullScreen={true}
          fullWidth
          maxWidth="sm"
          sx={{display: "flex", flexDirection: "column"}}
        >
          <ScopeSelector />
        </Dialog>
      )}
      {!isMobile && (
        <Menu open={open} onClose={() => setAnchorEl(null)} anchorEl={anchorEl}>
          <Box sx={{width: 300}}>
            <ScopeSelector />
          </Box>
        </Menu>
      )}
    </>
  );
}
