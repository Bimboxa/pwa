import { useState } from "react";
import { useDispatch } from "react-redux";

import { setSelectedPhotoListingId } from "../photosSlice";

import {
  Box,
  Button,
  Typography,
  Menu,
  MenuItem,
  Divider,
  ListItemIcon,
  ListItemText,
} from "@mui/material";
import ExpandMore from "@mui/icons-material/ExpandMore";
import Check from "@mui/icons-material/Check";
import Add from "@mui/icons-material/Add";

import DialogCreatePhotoAlbum from "./DialogCreatePhotoAlbum";

// ---------------------------------------------------------------------------
// FieldActivePhotoAlbum — "ALBUM ACTIF" select-style field of the Photos
// panel (same layout as the Dessin panel's FieldActiveListing). Opens the
// menu of the project's photo albums; the trailing item creates a new one.
// With no album at all, the field becomes the create CTA.
// ---------------------------------------------------------------------------

export default function FieldActivePhotoAlbum({ albums, activeAlbum }) {
  const dispatch = useDispatch();

  // strings

  const labelS = "Album actif";
  const addAlbumS = "Nouvel album";
  const createAlbumS = "Créer un album photos";

  // state

  const [menuAnchor, setMenuAnchor] = useState(null);
  const [openCreateAlbum, setOpenCreateAlbum] = useState(false);

  // helpers

  const hasNoAlbum = !albums?.length;

  // handlers

  const handleSelectAlbum = (listingId) => {
    dispatch(setSelectedPhotoListingId(listingId));
    setMenuAnchor(null);
  };

  const handleAddAlbum = () => {
    setMenuAnchor(null);
    setOpenCreateAlbum(true);
  };

  // render

  return (
    <Box sx={{ px: 1.5, py: 1 }}>
      {hasNoAlbum ? (
        <Button
          fullWidth
          variant="contained"
          color="secondary"
          onClick={() => setOpenCreateAlbum(true)}
        >
          {createAlbumS}
        </Button>
      ) : (
        <Box
          component="button"
          onClick={(e) => setMenuAnchor(e.currentTarget)}
          sx={{
            width: 1,
            display: "flex",
            alignItems: "center",
            gap: 1,
            textAlign: "left",
            px: 2,
            py: 1,
            cursor: "pointer",
            fontFamily: "inherit",
            bgcolor: "background.paper",
            border: "1px solid",
            borderColor: "divider",
            borderRadius: 3,
            "&:hover": { borderColor: "text.secondary" },
          }}
        >
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography
              variant="caption"
              sx={{
                display: "block",
                color: "text.secondary",
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                fontSize: "0.65rem",
              }}
            >
              {labelS}
            </Typography>
            <Typography
              variant="subtitle1"
              noWrap
              sx={{ fontWeight: 700, lineHeight: 1.3 }}
            >
              {activeAlbum?.name ?? "Album"}
            </Typography>
          </Box>
          <ExpandMore sx={{ color: "text.secondary", flexShrink: 0 }} />
        </Box>
      )}

      <Menu
        anchorEl={menuAnchor}
        open={Boolean(menuAnchor)}
        onClose={() => setMenuAnchor(null)}
        slotProps={{
          paper: {
            sx: {
              minWidth: menuAnchor?.offsetWidth ?? 240,
              borderRadius: 2,
              border: "1px solid",
              borderColor: "panel.border",
              mt: 0.5,
            },
          },
        }}
      >
        {albums?.map((album) => {
          const selected = album.id === activeAlbum?.id;
          return (
            <MenuItem
              key={album.id}
              selected={selected}
              onClick={() => handleSelectAlbum(album.id)}
              sx={{ gap: 1, py: 0.75 }}
            >
              <ListItemText
                primaryTypographyProps={{
                  variant: "body2",
                  fontWeight: selected ? 600 : 400,
                }}
              >
                {album.name ?? "Album"}
              </ListItemText>
              {selected && <Check sx={{ fontSize: 16, ml: "auto" }} />}
            </MenuItem>
          );
        })}
        <Divider />
        <MenuItem onClick={handleAddAlbum} sx={{ gap: 1, py: 0.75 }}>
          <ListItemIcon sx={{ minWidth: 28 }}>
            <Add sx={{ fontSize: 18, color: "panel.textMuted" }} />
          </ListItemIcon>
          <ListItemText
            primaryTypographyProps={{
              variant: "body2",
              color: "panel.textMuted",
            }}
          >
            {addAlbumS}
          </ListItemText>
        </MenuItem>
      </Menu>

      {openCreateAlbum && (
        <DialogCreatePhotoAlbum
          open={openCreateAlbum}
          onClose={() => setOpenCreateAlbum(false)}
        />
      )}
    </Box>
  );
}
