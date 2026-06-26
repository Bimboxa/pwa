import { useState, useMemo } from "react";

// MUI
import {
  Box,
  Typography,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  ListItemIcon,
  ListSubheader,
  createTheme,
  ThemeProvider,
  Popover,
  ButtonBase,
} from "@mui/material";

// Icons
import MapIcon from "@mui/icons-material/Map";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import CheckIcon from "@mui/icons-material/Check";

import useBaseMaps from "Features/baseMaps/hooks/useBaseMaps";
import useProjectBaseMapListings from "Features/baseMaps/hooks/useProjectBaseMapListings";

// Vertical-baseMap (élévation / coupe) selector for the elevation panel.
// Forks the dark style of BaseMapSelectorInMapEditorV2 (topBar) but:
//   - shows ONLY baseMaps with orientation === "VERTICAL",
//   - groups them by listing,
//   - has NO "create baseMap" action.
// Controlled: `value` is the selected baseMap id, `onChange(id)` on select.
export default function ElevationBaseMapSelector({ value, onChange }) {
  // data

  const { value: baseMaps = [] } = useBaseMaps({});
  const listings = useProjectBaseMapListings() ?? [];

  // state

  const [anchorEl, setAnchorEl] = useState(null);
  const open = Boolean(anchorEl);

  const darkTheme = useMemo(
    () =>
      createTheme({
        palette: {
          mode: "dark",
          background: { paper: "#1e1e1e" },
          primary: { main: "#90caf9" },
        },
      }),
    []
  );

  // helpers - vertical baseMaps grouped by listing

  const verticalBaseMaps = useMemo(
    () => (baseMaps ?? []).filter((bm) => bm?.orientation === "VERTICAL"),
    [baseMaps]
  );

  const groups = useMemo(() => {
    const byListing = new Map();
    for (const bm of verticalBaseMaps) {
      const key = bm.listingId ?? "__none__";
      if (!byListing.has(key)) byListing.set(key, []);
      byListing.get(key).push(bm);
    }
    // ordered by the project listings order, then any leftover groups
    const ordered = [];
    for (const listing of listings) {
      if (byListing.has(listing.id)) {
        ordered.push({ listing, baseMaps: byListing.get(listing.id) });
        byListing.delete(listing.id);
      }
    }
    for (const [key, bms] of byListing) {
      ordered.push({ listing: { id: key, name: "Autres" }, baseMaps: bms });
    }
    return ordered;
  }, [verticalBaseMaps, listings]);

  const activeBaseMap = useMemo(
    () => verticalBaseMaps.find((bm) => bm.id === value) ?? null,
    [verticalBaseMaps, value]
  );

  // handlers

  const handleOpen = (e) => setAnchorEl(e.currentTarget);
  const handleClose = () => setAnchorEl(null);

  const handleSelect = (bm) => {
    onChange?.(bm.id);
    handleClose();
  };

  // render

  return (
    <ThemeProvider theme={darkTheme}>
      <Box sx={{ display: "flex", justifyContent: "center" }}>
        <ButtonBase
          onClick={handleOpen}
          sx={{
            height: 32,
            pl: 2,
            pr: 2,
            borderRadius: 20,
            bgcolor: open ? "grey.800" : "#252525",
            border: "1px solid",
            borderColor: open ? "grey.600" : "rgba(255,255,255,0.1)",
            transition: "all 0.2s ease",
            "&:hover": {
              bgcolor: open ? "grey.700" : "#333",
              borderColor: open ? "grey.500" : "rgba(255,255,255,0.3)",
            },
          }}
        >
          <Typography
            variant="body2"
            noWrap
            sx={{
              fontWeight: 600,
              mr: 1,
              maxWidth: 220,
              color: open ? "grey.300" : "#ffffff",
              fontSize: "0.85rem",
            }}
          >
            {activeBaseMap?.name || "Sélectionner une élévation"}
          </Typography>
          <KeyboardArrowDownIcon
            sx={{
              fontSize: 18,
              color: open ? "grey.500" : "rgba(255,255,255,0.7)",
              transform: open ? "rotate(180deg)" : "none",
              transition: "0.2s",
            }}
          />
        </ButtonBase>
      </Box>

      <Popover
        open={open}
        anchorEl={anchorEl}
        onClose={handleClose}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
        transformOrigin={{ vertical: "top", horizontal: "center" }}
        slotProps={{
          paper: {
            sx: {
              width: 320,
              mt: 1,
              borderRadius: 2,
              backgroundImage: "none",
              bgcolor: "#1e1e1e",
              boxShadow: "0px 8px 24px rgba(0,0,0,0.6)",
              border: "1px solid",
              borderColor: "grey.800",
              overflow: "hidden",
            },
          },
        }}
      >
        {groups.length === 0 ? (
          <Box sx={{ p: 2 }}>
            <Typography variant="body2" color="grey.500">
              Aucune élévation (fond de plan vertical) dans ce projet.
            </Typography>
          </Box>
        ) : (
          <List dense sx={{ maxHeight: 380, overflowY: "auto", py: 0 }}>
            {groups.map(({ listing, baseMaps: bms }) => (
              <li key={listing.id}>
                <ul style={{ padding: 0 }}>
                  <ListSubheader
                    sx={{
                      bgcolor: "#1e1e1e",
                      color: "grey.500",
                      fontSize: "0.7rem",
                      lineHeight: "28px",
                      textTransform: "uppercase",
                      letterSpacing: 0.5,
                    }}
                  >
                    {listing.name}
                  </ListSubheader>
                  {bms.map((bm) => {
                    const isSelected = bm.id === value;
                    const thumbnail =
                      typeof bm.getThumbnail === "function"
                        ? bm.getThumbnail()
                        : null;
                    return (
                      <ListItem
                        key={bm.id}
                        disablePadding
                        sx={{
                          bgcolor: isSelected
                            ? "rgba(255, 255, 255, 0.05)"
                            : "transparent",
                        }}
                      >
                        <ListItemButton
                          onClick={() => handleSelect(bm)}
                          sx={{ py: 1 }}
                        >
                          <ListItemIcon sx={{ minWidth: 36 }}>
                            {isSelected ? (
                              <CheckIcon
                                sx={{ color: "grey.300" }}
                                fontSize="small"
                              />
                            ) : thumbnail ? (
                              <Box
                                component="img"
                                src={thumbnail}
                                sx={{
                                  width: 24,
                                  height: 24,
                                  borderRadius: 0.5,
                                }}
                              />
                            ) : (
                              <MapIcon
                                fontSize="small"
                                sx={{ color: "grey.600" }}
                              />
                            )}
                          </ListItemIcon>
                          <ListItemText
                            primary={bm.name}
                            primaryTypographyProps={{
                              variant: "body2",
                              color: isSelected ? "grey.100" : "grey.400",
                              fontWeight: isSelected ? 600 : 400,
                            }}
                          />
                        </ListItemButton>
                      </ListItem>
                    );
                  })}
                </ul>
              </li>
            ))}
          </List>
        )}
      </Popover>
    </ThemeProvider>
  );
}
