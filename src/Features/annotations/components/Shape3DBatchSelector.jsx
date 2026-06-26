import { useState } from "react";

import {
  Box,
  Chip,
  Divider,
  ListItemIcon,
  ListItemText,
  ListSubheader,
  Menu,
  MenuItem,
  Typography,
} from "@mui/material";
import Check from "@mui/icons-material/Check";
import ViewInArIcon from "@mui/icons-material/ViewInAr";

import useUpdateAnnotations from "../hooks/useUpdateAnnotations";
import useProfileAnnotationTemplates from "../hooks/useProfileAnnotationTemplates";
import useRevolutionAxes from "../hooks/useRevolutionAxes";
import useAnnotationSpriteImage from "../hooks/useAnnotationSpriteImage";
import {
  getShape3DKey,
  TYPES_SUPPORTING_PROFILES,
  TYPES_SUPPORTING_REVOLUTION,
} from "../constants/shape3DConfig";
import AnnotationTemplateIcon from "./AnnotationTemplateIcon";

const DEFAULT_LABEL = "Forme par défaut";
const MIXED_LABEL = "Formes variables";
const PROFILE_FALLBACK_LABEL = "Profil";

// Stable signature of a shape3D value, used to detect whether the current
// selection shares a single shape3D (uniform) or mixes several (mixed).
function shape3DSignature(shape3D) {
  const key = getShape3DKey(shape3D);
  if (key === "EXTRUSION_PROFILE")
    return `EXTRUSION_PROFILE:${shape3D?.profileTemplateId ?? ""}`;
  if (key === "REVOLUTION")
    return `REVOLUTION:${shape3D?.axisAnnotationId ?? ""}`;
  return key ?? "DEFAULT";
}

// Batch counterpart of Shape3DSelector: assigns a shape3D to every selected
// annotation at once. Mainly used to define a REVOLUTION around the same axis
// for several POLYLINEs in one click. A chosen shape is only applied to the
// annotations whose type supports it (e.g. REVOLUTION → POLYLINE only).
export default function Shape3DBatchSelector({ annotations }) {
  // data

  const updateAnnotations = useUpdateAnnotations();
  const profileTemplates = useProfileAnnotationTemplates();
  const revolutionAxes = useRevolutionAxes();
  const spriteImage = useAnnotationSpriteImage();

  // state

  const [anchorEl, setAnchorEl] = useState(null);

  // helpers

  if (!annotations || annotations.length === 0) return null;

  const someSupportProfiles = annotations.some((a) =>
    TYPES_SUPPORTING_PROFILES.includes(a.type)
  );
  const someSupportRevolution = annotations.some((a) =>
    TYPES_SUPPORTING_REVOLUTION.includes(a.type)
  );

  const showProfileSection = someSupportProfiles && profileTemplates.length > 0;
  const showRevolutionSection =
    someSupportRevolution && revolutionAxes.length > 0;

  // Nothing assignable across the selection → hide entirely.
  if (!showProfileSection && !showRevolutionSection) return null;

  // Uniform vs mixed selection (drives the chip label and the check marks).
  const signatures = new Set(
    annotations.map((a) => shape3DSignature(a.shape3D))
  );
  const isUniform = signatures.size === 1;
  const refShape3D = isUniform ? annotations[0]?.shape3D : null;
  const currentKey = isUniform ? getShape3DKey(refShape3D) : undefined;
  const currentProfileTemplateId = refShape3D?.profileTemplateId ?? null;
  const currentAxisAnnotationId = refShape3D?.axisAnnotationId ?? null;

  let chipLabel = MIXED_LABEL;
  if (isUniform) {
    if (currentKey === "EXTRUSION_PROFILE") {
      const t = profileTemplates.find((x) => x.id === currentProfileTemplateId);
      chipLabel = t?.label ?? PROFILE_FALLBACK_LABEL;
    } else if (currentKey === "REVOLUTION") {
      const axe = revolutionAxes.find((a) => a.id === currentAxisAnnotationId);
      chipLabel = axe?.label ? `Révolution · ${axe.label}` : "Révolution";
    } else {
      chipLabel = DEFAULT_LABEL;
    }
  }

  // handlers

  function handleOpen(e) {
    e.stopPropagation();
    setAnchorEl(e.currentTarget);
  }

  function handleClose() {
    setAnchorEl(null);
  }

  async function handleSelect(value) {
    const key = getShape3DKey(value);
    let targets;
    if (key === "REVOLUTION") {
      targets = annotations.filter((a) =>
        TYPES_SUPPORTING_REVOLUTION.includes(a.type)
      );
    } else if (key === "EXTRUSION_PROFILE") {
      targets = annotations.filter((a) =>
        TYPES_SUPPORTING_PROFILES.includes(a.type)
      );
    } else {
      // Default shape (null) clears the override on every selected annotation.
      targets = annotations;
    }
    const updates = targets.map((a) => ({ id: a.id, shape3D: value }));
    await updateAnnotations(updates);
    handleClose();
  }

  // render

  const isProfileSelected = (templateId) =>
    isUniform &&
    currentKey === "EXTRUSION_PROFILE" &&
    currentProfileTemplateId === templateId;
  const isRevolutionSelected = (axisId) =>
    isUniform &&
    currentKey === "REVOLUTION" &&
    currentAxisAnnotationId === axisId;
  const isDefaultSelected = isUniform && currentKey === null;

  return (
    <>
      <Divider />
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 1,
          px: 1.25,
          py: 0.75,
        }}
      >
        <Typography
          variant="caption"
          sx={{ color: "text.secondary", fontWeight: 500, flexShrink: 0 }}
        >
          Forme 3D
        </Typography>
        <Chip
          size="small"
          variant="outlined"
          icon={<ViewInArIcon sx={{ fontSize: "14px !important" }} />}
          label={chipLabel}
          onClick={handleOpen}
          onMouseDown={(e) => e.stopPropagation()}
          sx={{
            height: 24,
            fontSize: "0.75rem",
            cursor: "pointer",
            maxWidth: 200,
            "& .MuiChip-label": {
              px: 0.75,
              overflow: "hidden",
              textOverflow: "ellipsis",
            },
            "& .MuiChip-icon": { ml: 0.5 },
          }}
        />
        <Menu
          open={Boolean(anchorEl)}
          anchorEl={anchorEl}
          onClose={handleClose}
          anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
          transformOrigin={{ vertical: "top", horizontal: "right" }}
        >
          <MenuItem onClick={() => handleSelect(null)} dense>
            {isDefaultSelected && (
              <ListItemIcon>
                <Check fontSize="small" />
              </ListItemIcon>
            )}
            <ListItemText inset={!isDefaultSelected}>
              {DEFAULT_LABEL}
            </ListItemText>
          </MenuItem>

          {showProfileSection && [
            <ListSubheader
              key="profils-header"
              sx={{ lineHeight: "32px", fontWeight: "bold" }}
            >
              Profils
            </ListSubheader>,
            ...profileTemplates.map((t) => (
              <MenuItem
                key={t.id}
                onClick={() =>
                  handleSelect({
                    key: "EXTRUSION_PROFILE",
                    profileTemplateId: t.id,
                  })
                }
                dense
              >
                {isProfileSelected(t.id) ? (
                  <ListItemIcon>
                    <Check fontSize="small" />
                  </ListItemIcon>
                ) : (
                  <ListItemIcon>
                    <AnnotationTemplateIcon
                      template={t}
                      spriteImage={spriteImage}
                      size={18}
                    />
                  </ListItemIcon>
                )}
                <ListItemText>{t.label}</ListItemText>
              </MenuItem>
            )),
          ]}

          {showRevolutionSection && [
            <ListSubheader
              key="revolution-header"
              sx={{ lineHeight: "32px", fontWeight: "bold" }}
            >
              Révolution
            </ListSubheader>,
            ...revolutionAxes.map((axe) => (
              <MenuItem
                key={axe.id}
                onClick={() =>
                  handleSelect({ key: "REVOLUTION", axisAnnotationId: axe.id })
                }
                dense
              >
                {isRevolutionSelected(axe.id) && (
                  <ListItemIcon>
                    <Check fontSize="small" />
                  </ListItemIcon>
                )}
                <ListItemText inset={!isRevolutionSelected(axe.id)}>
                  {axe.label ?? "Axe"}
                </ListItemText>
              </MenuItem>
            )),
          ]}
        </Menu>
      </Box>
    </>
  );
}
