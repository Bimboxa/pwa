import { useState } from "react";
import {
  Box,
  Typography,
  Popover,
  IconButton,
  Slider,
  ButtonBase,
  Button,
  Menu,
  MenuItem,
} from "@mui/material";
import {
  ArrowDropDown as DownIcon,
  RestartAlt as ResetIcon,
} from "@mui/icons-material";

import ColorPickerContent from "Features/colors/components/ColorPickerContent";
import WhiteSectionGeneric from "Features/form/components/WhiteSectionGeneric";
import {
  MATERIAL3D_NONE_KEY,
  MATERIAL3D_OPTIONS,
} from "Features/photorealRender/utils/material3dPresets";

/**
 * "Rendu 3D" section of an annotation template, compact one-liner (same design as
 * the fill/stroke fields): the material preset stays visible and a colour·opacité
 * swatch opens the shared colour popover (branded palette + hex + opacity). The
 * 3D colour / opacity override the 2D ones when rendering in 3D; when null they
 * inherit the 2D values (dashed swatch + "Hériter du rendu 2D" reset).
 */
export default function FieldAnnotationTemplateRender3d({
  color3D,
  opacity3D,
  material3d,
  fallbackColor = "#cccccc",
  fallbackOpacity = 1,
  hasMaterial3d = false,
  onColor3DChange,
  onOpacity3DChange,
  onMaterial3dChange,
}) {
  const [anchorEl, setAnchorEl] = useState(null);
  const [materialAnchorEl, setMaterialAnchorEl] = useState(null);

  // data

  const hasColor3D = Boolean(color3D);
  const swatchColor = color3D || fallbackColor;
  const effectiveOpacity = opacity3D ?? fallbackOpacity;
  const hasOpacity3D = opacity3D !== null && opacity3D !== undefined;
  const opacityPct = Math.round(effectiveOpacity * 100);

  const materialKey = material3d ?? MATERIAL3D_NONE_KEY;
  const materialLabel =
    MATERIAL3D_OPTIONS.find(({ key }) => key === materialKey)?.label ??
    "Choisir une option";

  // handlers

  function handleOpacityChange(pct) {
    const clamped = Math.max(0, Math.min(100, Number(pct) || 0));
    onOpacity3DChange(clamped / 100);
  }

  // render

  return (
    <WhiteSectionGeneric>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
        <Typography variant="body2" sx={{ fontWeight: "bold", flex: 1 }}>
          Rendu 3D
        </Typography>

        {/* material preset — always visible */}
        {hasMaterial3d && (
          <ButtonBase
            onClick={(e) => setMaterialAnchorEl(e.currentTarget)}
            title="Matériau 3D"
            sx={{
              display: "flex",
              alignItems: "center",
              gap: 0.5,
              height: 30,
              pl: 1,
              pr: 0.5,
              maxWidth: 150,
              minWidth: 0,
              border: "1px solid",
              borderColor: "divider",
              borderRadius: 1.5,
            }}
          >
            <Typography
              variant="caption"
              noWrap
              sx={{ color: "text.secondary", minWidth: 0 }}
            >
              {materialLabel}
            </Typography>
            <DownIcon fontSize="small" sx={{ color: "text.secondary" }} />
          </ButtonBase>
        )}

        {/* colour + opacity swatch → popover */}
        <ButtonBase
          onClick={(e) => setAnchorEl(e.currentTarget)}
          title="Couleur et opacité 3D"
          sx={{
            flexShrink: 0,
            display: "flex",
            alignItems: "center",
            gap: 0.75,
            height: 30,
            pl: 0.5,
            pr: 1,
            border: "1px solid",
            borderColor: "divider",
            borderRadius: 1.5,
          }}
        >
          <Box
            sx={{
              width: 20,
              height: 20,
              borderRadius: 1,
              bgcolor: swatchColor,
              opacity: effectiveOpacity,
              boxShadow: "inset 0 0 0 1px rgba(0,0,0,0.12)",
              border: "1px dashed",
              borderColor: hasColor3D ? "transparent" : "text.disabled",
            }}
          />
          <Typography
            variant="caption"
            sx={{
              fontWeight: "bold",
              color: "text.secondary",
              whiteSpace: "nowrap",
            }}
          >
            {opacityPct}%
          </Typography>
        </ButtonBase>
      </Box>

      {/* material menu */}
      <Menu
        anchorEl={materialAnchorEl}
        open={Boolean(materialAnchorEl)}
        onClose={() => setMaterialAnchorEl(null)}
      >
        {MATERIAL3D_OPTIONS.map((option) => (
          <MenuItem
            key={option?.key}
            selected={option?.key === materialKey}
            onClick={() => {
              onMaterial3dChange(option.key);
              setMaterialAnchorEl(null);
            }}
          >
            <Typography noWrap variant="body2">
              {option?.label}
            </Typography>
          </MenuItem>
        ))}
      </Menu>

      {/* colour + opacity popover */}
      <Popover
        open={Boolean(anchorEl)}
        anchorEl={anchorEl}
        onClose={() => setAnchorEl(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        transformOrigin={{ vertical: "top", horizontal: "right" }}
        slotProps={{ paper: { sx: { mt: 1, borderRadius: 2, boxShadow: 6 } } }}
      >
        <ColorPickerContent
          color={swatchColor}
          onColorChange={onColor3DChange}
          onClose={() => setAnchorEl(null)}
        >
          {/* opacity */}
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ minWidth: 52 }}
            >
              Opacité
            </Typography>
            <Slider
              size="small"
              value={opacityPct}
              min={0}
              max={100}
              onChange={(e, v) => handleOpacityChange(v)}
              sx={{
                flex: 1,
                color: hasOpacity3D ? "primary.main" : "action.disabled",
              }}
            />
            <Typography
              variant="caption"
              sx={{ fontWeight: "bold", minWidth: 34, textAlign: "right" }}
            >
              {opacityPct}%
            </Typography>
            {hasOpacity3D && (
              <IconButton
                size="small"
                onClick={() => onOpacity3DChange(null)}
                title="Hériter l'opacité 2D"
              >
                <ResetIcon fontSize="inherit" />
              </IconButton>
            )}
          </Box>

          {/* inherit the 2D colour */}
          {hasColor3D && (
            <Button
              size="small"
              startIcon={<ResetIcon />}
              onClick={() => onColor3DChange(null)}
              sx={{ alignSelf: "flex-start", textTransform: "none" }}
            >
              Hériter la couleur 2D
            </Button>
          )}
        </ColorPickerContent>
      </Popover>
    </WhiteSectionGeneric>
  );
}
