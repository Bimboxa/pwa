import { useState, useMemo } from "react";

import useResolvedPresetListings from "../hooks/useResolvedPresetListings";
import useAppConfig from "Features/appConfig/hooks/useAppConfig";

import {
  Box,
  TextField,
  Chip,
  Menu,
  MenuItem,
  ListItemButton,
  Typography,
  List,
  InputAdornment,
} from "@mui/material";
import {
  Search,
  ArrowDropDown,
  Close,
  CheckBoxOutlineBlank,
  CheckBox,
} from "@mui/icons-material";

import BoxFlexVStretch from "Features/layout/components/BoxFlexVStretch";

export default function SectionPresetListingsSelector({
  selectedKeys,
  onChange,
  isForBaseMaps,
}) {
  // strings

  const searchPlaceholderS = "Rechercher...";
  const selectS = "Sélectionnez une ou plusieurs listes déjà configurées";

  // data

  const presetListings = useResolvedPresetListings();
  const appConfig = useAppConfig();

  // state

  const [searchText, setSearchText] = useState("");
  const [activeFilters, setActiveFilters] = useState({});
  const [menuAnchor, setMenuAnchor] = useState(null);
  const [menuGroup, setMenuGroup] = useState(null);

  // helpers - keyword groups from appConfig

  const keywordsGroups =
    appConfig?.features?.annotationTemplatesLibraries?.keywordsGroups ?? [];

  // helpers - extract all available keyword values per group

  const keywordValuesByGroup = useMemo(() => {
    const map = {};
    keywordsGroups.forEach((group) => {
      map[group] = new Set();
    });

    presetListings?.forEach((listing) => {
      listing.keywords?.forEach((keyword) => {
        const sepIndex = keyword.indexOf(":");
        if (sepIndex === -1) return;
        const group = keyword.slice(0, sepIndex);
        const value = keyword.slice(sepIndex + 1);
        if (map[group]) {
          map[group].add(value);
        }
      });
    });

    Object.keys(map).forEach((group) => {
      map[group] = [...map[group]];
    });

    return map;
  }, [presetListings, keywordsGroups]);

  // helpers - filtered listings

  const filteredListings = useMemo(() => {
    let items =
      presetListings?.filter((l) => l.annotationTemplatesLibrary) ?? [];

    if (isForBaseMaps) {
      items = items.filter((l) => l.isForBaseMaps === true);
    }

    if (searchText) {
      const search = searchText.toLowerCase();
      items = items.filter(
        (l) =>
          l.fullName?.toLowerCase().includes(search) ||
          l.name?.toLowerCase().includes(search)
      );
    }

    Object.entries(activeFilters).forEach(([group, value]) => {
      if (value) {
        items = items.filter((l) =>
          l.keywords?.some((kw) => kw === `${group}:${value}`)
        );
      }
    });

    return items;
  }, [presetListings, searchText, activeFilters, isForBaseMaps]);

  // handlers

  function handleChipClick(event, group) {
    if (activeFilters[group]) {
      setActiveFilters((prev) => {
        const next = { ...prev };
        delete next[group];
        return next;
      });
    } else {
      setMenuAnchor(event.currentTarget);
      setMenuGroup(group);
    }
  }

  function handleMenuSelect(group, value) {
    setActiveFilters((prev) => ({ ...prev, [group]: value }));
    setMenuAnchor(null);
    setMenuGroup(null);
  }

  function handleMenuClose() {
    setMenuAnchor(null);
    setMenuGroup(null);
  }

  function handleListingClick(listing) {
    const key = listing.key;
    let selection = selectedKeys ? [...selectedKeys] : [];
    if (selection.includes(key)) {
      selection = selection.filter((k) => k !== key);
    } else {
      selection.push(key);
    }
    onChange(selection);
  }

  // render

  return (
    <BoxFlexVStretch>
      <Box sx={{ p: 1 }}>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
          {selectS}
        </Typography>

        <TextField
          size="small"
          fullWidth
          placeholder={searchPlaceholderS}
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          slotProps={{
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <Search fontSize="small" />
                </InputAdornment>
              ),
            },
          }}
        />
      </Box>

      <Box sx={{ px: 1, pb: 1, mb: 2, display: "flex", gap: 0.5, flexWrap: "wrap" }}>
        {keywordsGroups.map((group) => {
          const isActive = Boolean(activeFilters[group]);
          return (
            <Chip
              key={group}
              label={isActive ? activeFilters[group] : group}
              size="small"
              onClick={(e) => handleChipClick(e, group)}
              onDelete={
                isActive ? () => handleChipClick(null, group) : undefined
              }
              deleteIcon={isActive ? <Close fontSize="small" /> : undefined}
              icon={!isActive ? <ArrowDropDown /> : undefined}
              variant={isActive ? "filled" : "outlined"}
              color={isActive ? "primary" : "default"}
            />
          );
        })}

        <Menu
          anchorEl={menuAnchor}
          open={Boolean(menuAnchor)}
          onClose={handleMenuClose}
        >
          {menuGroup &&
            keywordValuesByGroup[menuGroup]?.map((value) => (
              <MenuItem
                key={value}
                onClick={() => handleMenuSelect(menuGroup, value)}
              >
                {value}
              </MenuItem>
            ))}
        </Menu>
      </Box>

      <BoxFlexVStretch sx={{ overflow: "auto", bgcolor: "white", borderRadius: 1 }}>
        <List dense disablePadding>
          {filteredListings.map((listing) => {
            const checked = selectedKeys?.includes(listing.key);
            return (
              <ListItemButton
                key={listing.key}
                onClick={() => handleListingClick(listing)}
                divider
                selected={checked}
                sx={{ py: 0.5 }}
              >
                <Box
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    width: 1,
                    justifyContent: "space-between",
                  }}
                >
                  <Typography variant="button">
                    {listing.fullName ?? listing.name}
                  </Typography>
                  <Box
                    color="secondary.main"
                    sx={{ display: "flex", alignItems: "center" }}
                  >
                    {checked ? <CheckBox /> : <CheckBoxOutlineBlank />}
                  </Box>
                </Box>
              </ListItemButton>
            );
          })}
        </List>
      </BoxFlexVStretch>
    </BoxFlexVStretch>
  );
}
