import { useState } from "react";
import {
  Box,
  Typography,
  Popover,
  Slider,
  ButtonBase,
  Button,
  Menu,
  MenuItem,
} from "@mui/material";
import {
  ArrowDropDown as DownIcon,
  Check as CheckIcon,
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
 * inherit the 2D values. Inheriting is an explicit, always-visible option of the
 * popover ("Même couleur que l'annotation 2D" / "= 2D" on the opacity row) so a
 * user can always come back to it, and the header "Réinit." clears the three
 * overrides (colour, opacity, material) at once.
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
  onReset,
}) {
  // strings

  const titleS = "Rendu 3D";
  const resetS = "Réinit.";
  const materialTitleS = "Matériau 3D";
  const swatchTitleS = "Couleur et opacité 3D";
  const chooseOptionS = "Choisir une option";
  const inheritColorS = "Même couleur que l'annotation 2D";
  const inheritOpacityS = "Même opacité que l'annotation 2D";
  const inheritedShortS = "2D";
  const opacityS = "Opacité";
  const inheritedTitleS = "Couleur et opacité héritées de l'annotation 2D";

  // state

  const [anchorEl, setAnchorEl] = useState(null);
  const [materialAnchorEl, setMaterialAnchorEl] = useState(null);

  // data

  const hasColor3D = Boolean(color3D);
  const swatchColor = color3D || fallbackColor;
  const effectiveOpacity = opacity3D ?? fallbackOpacity;
  const hasOpacity3D = opacity3D !== null && opacity3D !== undefined;
  const opacityPct = Math.round(effectiveOpacity * 100);
  const inheritsAll = !hasColor3D && !hasOpacity3D;

  const materialKey = material3d ?? MATERIAL3D_NONE_KEY;
  const hasMaterialValue =
    material3d !== null &&
    material3d !== undefined &&
    material3d !== MATERIAL3D_NONE_KEY;
  const materialLabel =
    MATERIAL3D_OPTIONS.find(({ key }) => key === materialKey)?.label ??
    chooseOptionS;

  const showReset =
    typeof onReset === "function" &&
    (hasColor3D || hasOpacity3D || hasMaterialValue);

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
          {titleS}
        </Typography>

        {showReset && (
          <Button size="small" onClick={() => onReset()}>
            {resetS}
          </Button>
        )}

        {/* material preset — always visible */}
        {hasMaterial3d && (
          <ButtonBase
            onClick={(e) => setMaterialAnchorEl(e.currentTarget)}
            title={materialTitleS}
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
          title={inheritsAll ? inheritedTitleS : swatchTitleS}
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
          {inheritsAll && (
            <Typography
              variant="caption"
              sx={{ color: "text.disabled", whiteSpace: "nowrap" }}
            >
              {inheritedShortS}
            </Typography>
          )}
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
          color={color3D ?? null}
          placeholder={fallbackColor}
          onColorChange={onColor3DChange}
          onClose={() => setAnchorEl(null)}
          header={
            /* explicit "inherit the 2D colour" option, always visible */
            <ButtonBase
              onClick={() => onColor3DChange(null)}
              sx={{
                display: "flex",
                alignItems: "center",
                gap: 1,
                width: 1,
                px: 1,
                py: 0.75,
                borderRadius: 1,
                border: "1px solid",
                borderColor: hasColor3D ? "divider" : "text.primary",
                bgcolor: hasColor3D ? "transparent" : "action.selected",
                textAlign: "left",
              }}
            >
              <Box
                sx={{
                  width: 22,
                  height: 22,
                  flexShrink: 0,
                  borderRadius: 1,
                  bgcolor: fallbackColor,
                  opacity: fallbackOpacity,
                  border: "1px dashed",
                  borderColor: "text.disabled",
                  boxShadow: "inset 0 0 0 1px rgba(0,0,0,0.1)",
                }}
              />
              <Typography variant="body2" sx={{ flex: 1 }}>
                {inheritColorS}
              </Typography>
              {!hasColor3D && <CheckIcon fontSize="small" />}
            </ButtonBase>
          }
        >
          {/* opacity */}
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ minWidth: 52 }}
            >
              {opacityS}
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
            {/* explicit "inherit the 2D opacity" option, always visible */}
            <ButtonBase
              onClick={() => onOpacity3DChange(null)}
              title={inheritOpacityS}
              sx={{
                display: "flex",
                alignItems: "center",
                gap: 0.25,
                height: 22,
                px: 0.75,
                borderRadius: 1,
                border: "1px solid",
                borderColor: hasOpacity3D ? "divider" : "text.primary",
                bgcolor: hasOpacity3D ? "transparent" : "action.selected",
              }}
            >
              {!hasOpacity3D && <CheckIcon sx={{ fontSize: 14 }} />}
              <Typography variant="caption" sx={{ whiteSpace: "nowrap" }}>
                = {inheritedShortS}
              </Typography>
            </ButtonBase>
          </Box>
        </ColorPickerContent>
      </Popover>
    </WhiteSectionGeneric>
  );
}
