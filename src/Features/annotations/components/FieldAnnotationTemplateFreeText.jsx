import { useState } from "react";

import {
  Box,
  Typography,
  Popover,
  Switch,
  Button,
  ButtonBase,
  IconButton,
  InputBase,
  ToggleButtonGroup,
  ToggleButton,
  Select,
  MenuItem,
} from "@mui/material";
import {
  MoreHoriz,
  Lock as LockIcon,
  LockOpen as LockOpenIcon,
  FormatBold,
  FormatItalic,
  FormatUnderlined,
  FormatAlignLeft,
  FormatAlignCenter,
  FormatAlignRight,
} from "@mui/icons-material";

import WhiteSectionGeneric from "Features/form/components/WhiteSectionGeneric";
import ColorPickerContent from "Features/colors/components/ColorPickerContent";

import {
  FREE_TEXT_FONT_OPTIONS,
  FREE_TEXT_FIELDS,
  FREE_TEXT_PAGE_FORMATS,
  getFreeTextFontStack,
} from "Features/annotations/constants/freeTextConstants";
import { getDefaultsForShape } from "Features/annotations/constants/drawingShapeConfig";

const ALIGN_OPTIONS = [
  { value: "LEFT", icon: <FormatAlignLeft fontSize="small" /> },
  { value: "CENTER", icon: <FormatAlignCenter fontSize="small" /> },
  { value: "RIGHT", icon: <FormatAlignRight fontSize="small" /> },
];

const toggleGroupSx = {
  flexShrink: 0,
  bgcolor: "action.hover",
  "& .MuiToggleButton-root": {
    border: "none",
    borderRadius: 1.5,
    px: 1,
    py: 0.25,
    fontSize: "0.7rem",
  },
};

const numberInputSx = {
  width: 64,
  border: "1px solid",
  borderColor: "divider",
  borderRadius: 1,
  px: 1,
  height: 28,
  fontSize: "0.8rem",
  "& input": { textAlign: "center", p: 0 },
};

const optionRowSx = {
  display: "flex",
  alignItems: "center",
  gap: 1,
  py: 0.5,
};

// Clickable color dot opening the shared brand color picker.
function ColorDot({ value, onChange, title, disabled }) {
  const [anchorEl, setAnchorEl] = useState(null);
  return (
    <>
      <Box
        onClick={(e) => !disabled && setAnchorEl(e.currentTarget)}
        title={title}
        sx={{
          width: 24,
          height: 24,
          borderRadius: "50%",
          bgcolor: value || "#fff",
          cursor: disabled ? "default" : "pointer",
          border: "2px solid",
          borderColor: "divider",
          opacity: disabled ? 0.4 : 1,
          flexShrink: 0,
          "&:hover": disabled ? {} : { transform: "scale(1.1)" },
          transition: "transform 0.2s",
        }}
      />
      <Popover
        open={Boolean(anchorEl)}
        anchorEl={anchorEl}
        onClose={() => setAnchorEl(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        transformOrigin={{ vertical: "top", horizontal: "right" }}
        slotProps={{ paper: { sx: { mt: 1, borderRadius: 2, boxShadow: 6 } } }}
      >
        <ColorPickerContent
          color={value}
          onColorChange={onChange}
          onClose={() => setAnchorEl(null)}
        />
      </Popover>
    </>
  );
}

// Compact single-line FREE_TEXT editor: text alignment stays visible, every
// other option (font, size, B/I/U, colors, background / border / padding /
// connector toggles) lives in a "..." popover with a live preview.
export default function FieldAnnotationTemplateFreeText({
  annotationTemplate,
  onChange,
  overrideFields,
  onOverrideFieldsChange,
  label = "Texte",
}) {
  const {
    fillColor = "#ffffff",
    hasBackground = true,
    textColor = "#000000",
    borderColor = "#000000",
    fontFamily = "Roboto",
    fontSize = 14,
    pageFormat = "A4",
    fontWeight = "normal",
    fontItalic = false,
    fontUnderline = false,
    textAlign = "LEFT",
    hasBorder = false,
    hasPadding = true,
    hasConnector = false,
  } = annotationTemplate ?? {};

  const [anchorEl, setAnchorEl] = useState(null);

  const showOverrides = typeof onOverrideFieldsChange === "function";
  const allLocked =
    Array.isArray(overrideFields) &&
    FREE_TEXT_FIELDS.every((f) => overrideFields.includes(f));

  // helpers

  const styleValues = [
    ...(fontWeight === "bold" ? ["bold"] : []),
    ...(fontItalic ? ["italic"] : []),
    ...(fontUnderline ? ["underline"] : []),
  ];

  // handlers

  function patch(changes) {
    onChange({ ...annotationTemplate, ...changes });
  }

  function handleTextAlignChange(e, newAlign) {
    if (newAlign !== null) patch({ textAlign: newAlign });
  }

  function handleStyleChange(e, newValues) {
    patch({
      fontWeight: newValues.includes("bold") ? "bold" : "normal",
      fontItalic: newValues.includes("italic"),
      fontUnderline: newValues.includes("underline"),
    });
  }

  function handleFontSizeChange(raw) {
    const parsed = raw === "" ? 14 : Number(raw);
    patch({ fontSize: Number.isFinite(parsed) && parsed > 0 ? parsed : 14 });
  }

  function handlePageFormatChange(e, newFormat) {
    if (newFormat !== null) patch({ pageFormat: newFormat });
  }

  function handleToggleGlobalOverride() {
    const current = Array.isArray(overrideFields) ? [...overrideFields] : [];
    const next = allLocked
      ? current.filter((f) => !FREE_TEXT_FIELDS.includes(f))
      : Array.from(new Set([...current, ...FREE_TEXT_FIELDS]));
    onOverrideFieldsChange(next);
  }

  function handleReset() {
    const defaults = getDefaultsForShape("FREE_TEXT");
    const changes = {};
    FREE_TEXT_FIELDS.forEach((field) => {
      if (field in defaults) changes[field] = defaults[field];
    });
    patch(changes);
  }

  // render

  return (
    <WhiteSectionGeneric>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
        <Typography variant="body2" sx={{ fontWeight: "bold", flex: 1 }}>
          {label}
        </Typography>

        {/* alignment — always visible */}
        <ToggleButtonGroup
          value={textAlign}
          exclusive
          onChange={handleTextAlignChange}
          size="small"
          sx={toggleGroupSx}
        >
          {ALIGN_OPTIONS.map((o) => (
            <ToggleButton key={o.value} value={o.value}>
              {o.icon}
            </ToggleButton>
          ))}
        </ToggleButtonGroup>

        {/* "..." → options popover */}
        <ButtonBase
          onClick={(e) => setAnchorEl(e.currentTarget)}
          title="Options du texte"
          sx={{
            flexShrink: 0,
            display: "flex",
            alignItems: "center",
            height: 30,
            px: 1,
            border: "1px solid",
            borderColor: "divider",
            borderRadius: 1.5,
          }}
        >
          <MoreHoriz fontSize="small" />
        </ButtonBase>

        {showOverrides && (
          <IconButton
            size="small"
            onClick={handleToggleGlobalOverride}
            title="Appliquer ces réglages aux textes déjà créés"
            sx={{ color: allLocked ? "primary.main" : "text.disabled" }}
          >
            {allLocked ? (
              <LockIcon fontSize="small" />
            ) : (
              <LockOpenIcon fontSize="small" />
            )}
          </IconButton>
        )}
      </Box>

      <Popover
        open={Boolean(anchorEl)}
        anchorEl={anchorEl}
        onClose={() => setAnchorEl(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        transformOrigin={{ vertical: "top", horizontal: "right" }}
        slotProps={{ paper: { sx: { mt: 1, borderRadius: 2, boxShadow: 6 } } }}
      >
        <Box sx={{ width: 280 }}>
          {/* preview header */}
          <Box sx={{ display: "flex", alignItems: "center", px: 1.5, pt: 1 }}>
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ textTransform: "uppercase", flex: 1 }}
            >
              Aperçu
            </Typography>
            <Button size="small" onClick={handleReset}>
              Réinit.
            </Button>
          </Box>

          {/* live preview */}
          <Box
            sx={{
              display: "flex",
              justifyContent: "center",
              bgcolor: "background.default",
              py: 1.5,
              px: 1.5,
            }}
          >
            <Box
              sx={{
                minWidth: 120,
                maxWidth: 1,
                backgroundColor: hasBackground ? fillColor : "transparent",
                border: `1px solid ${hasBorder ? borderColor : "transparent"}`,
                borderRadius: "2px",
                padding: hasPadding ? "4px 8px" : 0,
                fontFamily: getFreeTextFontStack(fontFamily),
                fontSize: `${Math.max(8, Math.min(28, Number(fontSize) || 14))}px`,
                fontWeight: fontWeight === "bold" ? "bold" : "normal",
                fontStyle: fontItalic ? "italic" : "normal",
                textDecoration: fontUnderline ? "underline" : "none",
                textAlign: { LEFT: "left", CENTER: "center", RIGHT: "right" }[
                  textAlign
                ],
                lineHeight: 1.2,
                color: textColor,
                overflow: "hidden",
              }}
            >
              Texte
            </Box>
          </Box>

          {/* options */}
          <Box
            sx={{
              px: 1.5,
              pb: 0.5,
              "& > *": { borderTop: "1px solid", borderColor: "divider" },
              "& > *:first-of-type": { borderTop: "none" },
            }}
          >
            <Box sx={optionRowSx}>
              <Typography variant="body2" sx={{ flex: 1 }}>
                Police
              </Typography>
              <Select
                value={fontFamily}
                onChange={(e) => patch({ fontFamily: e.target.value })}
                size="small"
                variant="standard"
                disableUnderline
                sx={{ fontSize: "0.8rem", minWidth: 130 }}
              >
                {FREE_TEXT_FONT_OPTIONS.map((o) => (
                  <MenuItem
                    key={o.key}
                    value={o.key}
                    sx={{ fontFamily: o.stack, fontSize: "0.85rem" }}
                  >
                    {o.label}
                  </MenuItem>
                ))}
              </Select>
            </Box>

            <Box sx={optionRowSx}>
              <Typography variant="body2" sx={{ flex: 1 }}>
                Taille du texte
              </Typography>
              <InputBase
                type="number"
                value={fontSize ?? ""}
                onChange={(e) => handleFontSizeChange(e.target.value)}
                endAdornment={
                  <Typography variant="caption" color="text.secondary">
                    px
                  </Typography>
                }
                sx={numberInputSx}
              />
            </Box>

            {/* The size is in PDF points as if the base map filled this
                page: pick the format the plan will be exported on. */}
            <Box sx={optionRowSx}>
              <Typography variant="body2" sx={{ flex: 1 }}>
                Format de la page
              </Typography>
              <ToggleButtonGroup
                value={pageFormat}
                exclusive
                onChange={handlePageFormatChange}
                size="small"
                sx={toggleGroupSx}
              >
                {FREE_TEXT_PAGE_FORMATS.map((f) => (
                  <ToggleButton key={f.key} value={f.key}>
                    {f.label}
                  </ToggleButton>
                ))}
              </ToggleButtonGroup>
            </Box>

            <Box sx={optionRowSx}>
              <Typography variant="body2" sx={{ flex: 1 }}>
                Style
              </Typography>
              <ToggleButtonGroup
                value={styleValues}
                onChange={handleStyleChange}
                size="small"
                sx={toggleGroupSx}
              >
                <ToggleButton value="bold" title="Gras">
                  <FormatBold fontSize="small" />
                </ToggleButton>
                <ToggleButton value="italic" title="Italique">
                  <FormatItalic fontSize="small" />
                </ToggleButton>
                <ToggleButton value="underline" title="Souligné">
                  <FormatUnderlined fontSize="small" />
                </ToggleButton>
              </ToggleButtonGroup>
            </Box>

            <Box sx={optionRowSx}>
              <Typography variant="body2" sx={{ flex: 1 }}>
                Couleur du texte
              </Typography>
              <ColorDot
                value={textColor}
                onChange={(color) => patch({ textColor: color })}
                title="Couleur du texte"
              />
            </Box>

            <Box sx={optionRowSx}>
              <Typography variant="body2" sx={{ flex: 1 }}>
                Remplissage
              </Typography>
              <ColorDot
                value={fillColor}
                onChange={(color) => patch({ fillColor: color })}
                title="Couleur de remplissage"
                disabled={!hasBackground}
              />
              <Switch
                size="small"
                checked={Boolean(hasBackground)}
                onChange={(e) => patch({ hasBackground: e.target.checked })}
              />
            </Box>

            <Box sx={optionRowSx}>
              <Typography variant="body2" sx={{ flex: 1 }}>
                Bordure
              </Typography>
              <ColorDot
                value={borderColor}
                onChange={(color) => patch({ borderColor: color })}
                title="Couleur de la bordure"
                disabled={!hasBorder}
              />
              <Switch
                size="small"
                checked={Boolean(hasBorder)}
                onChange={(e) => patch({ hasBorder: e.target.checked })}
              />
            </Box>

            <Box sx={optionRowSx}>
              <Typography variant="body2" sx={{ flex: 1 }}>
                Marge intérieure
              </Typography>
              <Switch
                size="small"
                checked={Boolean(hasPadding)}
                onChange={(e) => patch({ hasPadding: e.target.checked })}
              />
            </Box>

            <Box sx={optionRowSx}>
              <Typography variant="body2" sx={{ flex: 1 }}>
                Trait de connexion
              </Typography>
              <Switch
                size="small"
                checked={Boolean(hasConnector)}
                onChange={(e) => patch({ hasConnector: e.target.checked })}
              />
            </Box>
          </Box>
        </Box>
      </Popover>
    </WhiteSectionGeneric>
  );
}
