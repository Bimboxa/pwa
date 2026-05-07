import { useState } from "react";

import {
  Chip,
  ListItemIcon,
  ListItemText,
  ListSubheader,
  Menu,
  MenuItem,
} from "@mui/material";
import Check from "@mui/icons-material/Check";
import ViewInArIcon from "@mui/icons-material/ViewInAr";

import useUpdateAnnotation from "../hooks/useUpdateAnnotation";
import useProfileAnnotationTemplates from "../hooks/useProfileAnnotationTemplates";
import useAnnotationSpriteImage from "../hooks/useAnnotationSpriteImage";
import {
  getShape3DKey,
  getShape3DOptionsForType,
  TYPES_SUPPORTING_PROFILES,
} from "../constants/shape3DConfig";
import AnnotationTemplateIcon from "./AnnotationTemplateIcon";

const DEFAULT_LABEL = "Forme par défaut";
const PROFILE_FALLBACK_LABEL = "Profil";

export default function Shape3DSelector({ annotation }) {
  // data

  const updateAnnotation = useUpdateAnnotation();
  const profileTemplates = useProfileAnnotationTemplates();
  const spriteImage = useAnnotationSpriteImage();
  const staticOptions = getShape3DOptionsForType(annotation?.type);

  // state

  const [anchorEl, setAnchorEl] = useState(null);

  // helpers

  if (!annotation) return null;

  const typeSupportsProfiles = TYPES_SUPPORTING_PROFILES.includes(annotation.type);
  const showProfileSection =
    typeSupportsProfiles && profileTemplates.length > 0;

  // Hide the chip entirely when there is nothing to pick.
  if (staticOptions.length === 0 && !showProfileSection) return null;

  const currentKey = getShape3DKey(annotation.shape3D);
  const currentProfileTemplateId =
    annotation.shape3D?.profileTemplateId ?? null;

  let chipLabel = DEFAULT_LABEL;
  if (currentKey === "EXTRUSION_PROFILE") {
    const t = profileTemplates.find((x) => x.id === currentProfileTemplateId);
    chipLabel = t?.label ?? PROFILE_FALLBACK_LABEL;
  } else if (currentKey != null) {
    const entry = staticOptions.find((o) => o.key === currentKey);
    chipLabel = entry?.label ?? DEFAULT_LABEL;
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
    await updateAnnotation({ id: annotation.id, shape3D: value });
    handleClose();
  }

  // render

  const isStaticSelected = (key) =>
    currentKey === key && currentKey !== "EXTRUSION_PROFILE";
  const isProfileSelected = (templateId) =>
    currentKey === "EXTRUSION_PROFILE" &&
    currentProfileTemplateId === templateId;

  return (
    <>
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
          {currentKey === null && (
            <ListItemIcon>
              <Check fontSize="small" />
            </ListItemIcon>
          )}
          <ListItemText inset={currentKey !== null}>
            {DEFAULT_LABEL}
          </ListItemText>
        </MenuItem>

        {staticOptions.map((opt) => (
          <MenuItem
            key={opt.key}
            onClick={() => handleSelect({ key: opt.key })}
            dense
          >
            {isStaticSelected(opt.key) && (
              <ListItemIcon>
                <Check fontSize="small" />
              </ListItemIcon>
            )}
            <ListItemText inset={!isStaticSelected(opt.key)}>
              {opt.label}
            </ListItemText>
          </MenuItem>
        ))}

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
      </Menu>
    </>
  );
}
