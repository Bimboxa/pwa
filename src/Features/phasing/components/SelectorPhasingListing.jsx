import { useState } from "react";
import { useDispatch, useSelector } from "react-redux";

import { setActivePhasingListingId } from "../phasingSlice";
import { setSelectedListingId } from "Features/businessObjects/businessObjectsSlice";
import { setToaster } from "Features/layout/layoutSlice";

import {
  Box,
  Divider,
  IconButton,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  Tooltip,
} from "@mui/material";
import { ThemeProvider } from "@mui/material/styles";
import { Add, ArrowDropDown, Check } from "@mui/icons-material";

import DialogCreateBusinessObjectListing from "Features/businessObjects/components/DialogCreateBusinessObjectListing";
import FieldNameInline from "./FieldNameInline";

import db from "App/db/db";
import appTheme from "Styles/theme";
import { getBusinessObjectTypeKeyFromModuleKey } from "Features/businessObjects/utils/businessObjectModuleKeys";
import { PHASING_TYPE_KEY } from "../constants";

// Phasing (PHASING listing) of the phases strip: its name, renamed in place,
// and a drop-down listing the phasings of the scope (click = that one drives
// the strip) with a "new phasing" entry. `listings`: every PHASING listing
// of the scope.
export default function SelectorPhasingListing({ listing, listings }) {
  const dispatch = useDispatch();

  // strings

  const renameS = "Renommer le phasage";
  const menuS = "Changer de phasage";
  const newS = "Nouveau phasage";
  const errorS = "Le phasage n'a pas pu être renommé.";

  // data

  // In the Phasage module the panel's listing drives the strip: selecting a
  // phasing here selects it there too.
  const isPhasingModule = useSelector(
    (s) =>
      getBusinessObjectTypeKeyFromModuleKey(s.viewers.selectedViewerKey) ===
      PHASING_TYPE_KEY
  );

  // state

  const [anchorEl, setAnchorEl] = useState(null);
  const [openCreate, setOpenCreate] = useState(false);

  // handlers

  async function handleRename(name) {
    try {
      await db.listings.update(listing.id, { name });
    } catch (error) {
      console.error("[SelectorPhasingListing]", error);
      dispatch(
        setToaster({ message: error?.message || errorS, isError: true })
      );
    }
  }

  function handleSelect(id) {
    setAnchorEl(null);
    if (isPhasingModule) dispatch(setSelectedListingId(id));
    dispatch(setActivePhasingListingId(id));
  }

  function handleNew() {
    setAnchorEl(null);
    setOpenCreate(true);
  }

  // render

  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        minWidth: 0,
        flexShrink: 1,
        color: "text.secondary",
      }}
    >
      <FieldNameInline
        value={listing.name}
        onCommit={handleRename}
        tooltip={renameS}
      />
      <Tooltip title={menuS}>
        <IconButton
          size="small"
          color="inherit"
          onClick={(e) => setAnchorEl(e.currentTarget)}
          sx={{ p: 0, flexShrink: 0 }}
        >
          <ArrowDropDown sx={{ fontSize: 20 }} />
        </IconButton>
      </Tooltip>

      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={() => setAnchorEl(null)}
        slotProps={{ list: { dense: true } }}
      >
        {(listings ?? []).map((l) => (
          <MenuItem
            key={l.id}
            selected={l.id === listing.id}
            onClick={() => handleSelect(l.id)}
          >
            <ListItemIcon>
              {l.id === listing.id && <Check sx={{ fontSize: 16 }} />}
            </ListItemIcon>
            <ListItemText>{l.name}</ListItemText>
          </MenuItem>
        ))}
        <Divider />
        <MenuItem onClick={handleNew}>
          <ListItemIcon>
            <Add sx={{ fontSize: 16 }} />
          </ListItemIcon>
          <ListItemText>{newS}</ListItemText>
        </MenuItem>
      </Menu>

      {/* the dialog keeps the app's light theme */}
      <ThemeProvider theme={appTheme}>
        <DialogCreateBusinessObjectListing
          open={openCreate}
          typeKey={PHASING_TYPE_KEY}
          onClose={() => setOpenCreate(false)}
          onCreated={(created) =>
            dispatch(setActivePhasingListingId(created.id))
          }
        />
      </ThemeProvider>
    </Box>
  );
}
