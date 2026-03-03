import { useState, useRef } from "react";
import { useSelector, useDispatch } from "react-redux";

import {
  setDefaultHeightForBaseMap,
  setDefaultHeightCategories,
} from "Features/mapEditor/mapEditorSlice";

import {
  Box,
  Typography,
  InputBase,
  IconButton,
  Popover,
  Checkbox,
  FormControlLabel,
} from "@mui/material";
import { FilterList as FilterListIcon } from "@mui/icons-material";

import useAppConfig from "Features/appConfig/hooks/useAppConfig";

export default function SectionDefaultHeight() {
  // data

  const dispatch = useDispatch();
  const appConfig = useAppConfig();
  const mappingCategories = appConfig?.mappingCategories;

  const baseMapId = useSelector((s) => s.mapEditor.selectedBaseMapId);
  const defaultHeightByBaseMap = useSelector(
    (s) => s.mapEditor.defaultHeightByBaseMap
  );
  const selectedCategories = useSelector(
    (s) => s.mapEditor.defaultHeightCategories
  );

  // state

  const currentHeight = baseMapId
    ? (defaultHeightByBaseMap[baseMapId] ?? "")
    : "";
  const [localValue, setLocalValue] = useState(currentHeight);
  const [anchorEl, setAnchorEl] = useState(null);
  const debounceTimer = useRef(null);

  // helpers

  const open = Boolean(anchorEl);

  // sync local value when baseMap changes
  const prevBaseMapIdRef = useRef(baseMapId);
  if (prevBaseMapIdRef.current !== baseMapId) {
    prevBaseMapIdRef.current = baseMapId;
    setLocalValue(
      baseMapId ? (defaultHeightByBaseMap[baseMapId] ?? "") : ""
    );
  }

  // handlers

  function handleHeightChange(e) {
    e.stopPropagation();
    e.preventDefault();

    const newValue = e.target.value;
    setLocalValue(newValue);

    if (debounceTimer.current) clearTimeout(debounceTimer.current);

    debounceTimer.current = setTimeout(() => {
      if (!baseMapId) return;
      let valStr = String(newValue).replace(",", ".");
      let finalValue = null;
      if (valStr !== "" && !valStr.endsWith(".")) {
        const num = parseFloat(valStr);
        if (!isNaN(num)) finalValue = num;
      } else if (valStr.endsWith(".")) {
        finalValue = valStr;
      }
      dispatch(
        setDefaultHeightForBaseMap({
          baseMapId,
          height: finalValue,
        })
      );
    }, 400);
  }

  function handleKeyDown(e) {
    if (e.key === "Backspace" || e.key === "Delete") {
      e.stopPropagation();
    }
  }

  function handleToggleCategory(categoryKey) {
    const next = selectedCategories.includes(categoryKey)
      ? selectedCategories.filter((c) => c !== categoryKey)
      : [...selectedCategories, categoryKey];
    dispatch(setDefaultHeightCategories(next));
  }

  // render

  if (!mappingCategories?.length) return null;

  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        bgcolor: "background.paper",
        borderRadius: 1,
        boxShadow: 1,
        px: 0.5,
      }}
    >
      <Typography
        variant="body2"
        color="text.secondary"
        noWrap
        sx={{ pl: 0.5 }}
      >
        ht.
      </Typography>

      <InputBase
        value={localValue}
        onChange={handleHeightChange}
        onKeyDown={handleKeyDown}
        placeholder="-"
        sx={{
          width: "48px",
          "& .MuiInputBase-input": {
            fontSize: (theme) => theme.typography.body2?.fontSize,
            px: 0.5,
            py: 0.25,
            textAlign: "center",
          },
        }}
      />

      <Typography variant="body2" color="text.secondary" noWrap>
        m
      </Typography>

      <IconButton
        size="small"
        onClick={(e) => setAnchorEl(e.currentTarget)}
        color={selectedCategories.length > 0 ? "primary" : "default"}
      >
        <FilterListIcon fontSize="small" />
      </IconButton>

      <Popover
        open={open}
        anchorEl={anchorEl}
        onClose={() => setAnchorEl(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        transformOrigin={{ vertical: "top", horizontal: "right" }}
      >
        <Box sx={{ p: 1.5, minWidth: 200 }}>
          {mappingCategories.map((group) => (
            <Box key={group.nomenclature.key} sx={{ mb: 1 }}>
              <Typography variant="caption" color="text.secondary">
                {group.nomenclature.label}
              </Typography>
              {group.categories.map((cat) => {
                const key = `${group.nomenclature.key}:${cat.key}`;
                return (
                  <FormControlLabel
                    key={key}
                    sx={{ display: "flex", ml: 0, mr: 0 }}
                    control={
                      <Checkbox
                        size="small"
                        checked={selectedCategories.includes(key)}
                        onChange={() => handleToggleCategory(key)}
                      />
                    }
                    label={
                      <Typography variant="body2">{cat.label}</Typography>
                    }
                  />
                );
              })}
            </Box>
          ))}
        </Box>
      </Popover>
    </Box>
  );
}
