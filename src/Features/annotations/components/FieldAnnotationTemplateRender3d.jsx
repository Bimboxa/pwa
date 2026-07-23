import { useState, useRef, useEffect } from "react";
import {
  Box,
  Typography,
  Popover,
  IconButton,
  Slider,
  InputBase,
  Tooltip,
  Button,
  Menu,
  MenuItem,
} from "@mui/material";
import {
  Close as CloseIcon,
  RestartAlt as ResetIcon,
  ArrowDropDown as DownIcon,
} from "@mui/icons-material";
import { CompactPicker } from "react-color";
import WhiteSectionGeneric from "Features/form/components/WhiteSectionGeneric";
import {
  MATERIAL3D_NONE_KEY,
  MATERIAL3D_OPTIONS,
} from "Features/photorealRender/utils/material3dPresets";

// Mirrors the small auto-sizing % input used in FieldAnnotationTemplateFill.
function OpacityInput({ value, onChange }) {
  const [width, setWidth] = useState(30);
  const spanRef = useRef(null);

  useEffect(() => {
    if (spanRef.current) {
      setWidth(Math.max(25, spanRef.current.offsetWidth + 4));
    }
  }, [value]);

  return (
    <Box
      sx={{
        display: "inline-flex",
        alignItems: "center",
        position: "relative",
      }}
    >
      <span
        ref={spanRef}
        style={{
          position: "absolute",
          visibility: "hidden",
          whiteSpace: "pre",
          fontSize: "0.875rem",
          fontWeight: "bold",
        }}
      >
        {value || "0"}
      </span>
      <InputBase
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value.replace(/[^0-9.]/g, ""))}
        sx={{
          width,
          fontSize: "0.875rem",
          fontWeight: "bold",
          "& input": { textAlign: "right", p: 0 },
        }}
      />
    </Box>
  );
}

/**
 * "Rendu 3D" section of an annotation template: 3D-only color / opacity that
 * override the 2D color/opacity when rendering in 3D, plus the 3D material
 * preset. When color3D / opacity3D are null, the 3D render falls back to the
 * 2D color/opacity (fallbackColor / fallbackOpacity are shown as the inherited
 * placeholder value).
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

  const materialKey = material3d ?? MATERIAL3D_NONE_KEY;
  const materialLabel =
    MATERIAL3D_OPTIONS.find(({ key }) => key === materialKey)?.label ??
    "Choisir une option";

  // handlers

  const handleColorChange = (color) => onColor3DChange(color.hex);
  const handleResetColor = () => onColor3DChange(null);

  const handleOpacitySlider = (e, val) => onOpacity3DChange(val / 100);
  const handleResetOpacity = () => onOpacity3DChange(null);

  const open = Boolean(anchorEl);

  // render

  return (
    <WhiteSectionGeneric>
      <Typography variant="body2" sx={{ fontWeight: "bold", mb: 2 }}>
        Rendu 3D
      </Typography>

      <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
        {/* COLOR */}
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <Typography variant="body2" color="text.secondary">
            Couleur
          </Typography>
          <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
            {hasColor3D && (
              <Tooltip title="Utiliser la couleur 2D">
                <IconButton size="small" onClick={handleResetColor}>
                  <ResetIcon fontSize="inherit" />
                </IconButton>
              </Tooltip>
            )}
            <Box
              onClick={(e) => setAnchorEl(e.currentTarget)}
              sx={{
                width: 24,
                height: 24,
                borderRadius: "50%",
                bgcolor: swatchColor,
                cursor: "pointer",
                border: hasColor3D ? "2px solid" : "2px dashed",
                borderColor: "divider",
                transition: "transform 0.2s",
                "&:hover": { transform: "scale(1.1)" },
              }}
            />
          </Box>
        </Box>

        {/* OPACITY */}
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <Typography
            variant="body2"
            color="text.secondary"
            sx={{ minWidth: 60 }}
          >
            Opacité
          </Typography>
          <Slider
            size="small"
            value={Math.round(effectiveOpacity * 100)}
            onChange={handleOpacitySlider}
            sx={{
              flex: 1,
              color: hasOpacity3D ? "primary.main" : "action.disabled",
            }}
          />
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              bgcolor: "action.hover",
              px: 1,
              py: 0.5,
              borderRadius: 1.5,
              minWidth: 50,
              justifyContent: "flex-end",
            }}
          >
            <OpacityInput
              value={Math.round(effectiveOpacity * 100)}
              onChange={(val) => onOpacity3DChange(Number(val) / 100)}
            />
            <Typography
              variant="caption"
              sx={{ ml: 0.5, fontWeight: "bold", color: "text.secondary" }}
            >
              %
            </Typography>
          </Box>
          {hasOpacity3D && (
            <Tooltip title="Utiliser l'opacité 2D">
              <IconButton size="small" onClick={handleResetOpacity}>
                <ResetIcon fontSize="inherit" />
              </IconButton>
            </Tooltip>
          )}
        </Box>

        {/* MATERIAL (PHOTOREAL) */}
        {hasMaterial3d && (
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <Typography variant="body2" color="text.secondary">
              Matériau
            </Typography>
            <Button
              size="small"
              endIcon={<DownIcon />}
              onClick={(e) => setMaterialAnchorEl(e.currentTarget)}
            >
              <Typography variant="button" noWrap>
                {materialLabel}
              </Typography>
            </Button>
          </Box>
        )}
      </Box>

      {/* MATERIAL MENU */}
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

      {/* COLOR POPOVER */}
      <Popover
        open={open}
        anchorEl={anchorEl}
        onClose={() => setAnchorEl(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        transformOrigin={{ vertical: "top", horizontal: "right" }}
        slotProps={{
          paper: {
            sx: {
              mt: 1,
              p: 0,
              overflow: "hidden",
              borderRadius: 2,
              boxShadow: 6,
            },
          },
        }}
      >
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            pl: 2,
            pr: 1,
            py: 0.5,
            borderBottom: "1px solid",
            borderColor: "divider",
            bgcolor: "action.hover",
          }}
        >
          <Typography variant="caption" sx={{ fontWeight: "bold" }}>
            Couleur du rendu 3D
          </Typography>
          <IconButton size="small" onClick={() => setAnchorEl(null)}>
            <CloseIcon fontSize="inherit" />
          </IconButton>
        </Box>
        <Box sx={{ p: 1 }}>
          <CompactPicker color={swatchColor} onChange={handleColorChange} />
        </Box>
      </Popover>
    </WhiteSectionGeneric>
  );
}
