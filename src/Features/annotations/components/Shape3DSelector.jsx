import { useState } from "react";
import PropTypes from "prop-types";
import { useDispatch } from "react-redux";

import { setToaster } from "Features/layout/layoutSlice";

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
import useProfileAnnotations from "../hooks/useProfileAnnotations";
import useRevolutionAxes from "../hooks/useRevolutionAxes";
import {
  getShape3DKey,
  getShape3DOptionsForType,
  getEffectiveShellMode,
  mergeShape3DOptions,
  TYPES_SUPPORTING_REVOLUTION,
} from "../constants/shape3DConfig";
import MenuSectionProfileTiles from "./MenuSectionProfileTiles";
import toggleProfileSourceOnAnnotationsService from "Features/elevation/services/toggleProfileSourceOnAnnotationsService";
import getAppliedProfileSourceIds, {
  getAppliedProfileChipLabel,
} from "../utils/getAppliedProfileSourceIds";

const DEFAULT_LABEL = "Forme par défaut";
// Legacy template-driven profile (shape3D EXTRUSION_PROFILE): no longer
// assignable from the menu, still read by the 3D build — named on the chip
// so « Forme par défaut » can clear it.
const LEGACY_TEMPLATE_PROFILE_LABEL = "Profil (modèle)";
const APPLY_FAILED_LABEL = "Profil non appliqué (géométrie insuffisante)";
const REMOVED_LABEL = "Profil retiré (Ctrl+Z pour annuler)";

// « Forme par défaut » chip of ToolbarEditAnnotation: the annotation's
// shape3D (static per-type shapes, « Révolution » around a scope axis) plus,
// for a POLYLINE, the scope's profile DRAWINGS as tiles — a click applies the
// profile as an inline profile line (same as « Ajouter un profil »), a click
// on an applied one removes it (toggleProfileSourceOnAnnotationsService).
export default function Shape3DSelector({ annotation }) {
  const dispatch = useDispatch();

  // data

  const updateAnnotation = useUpdateAnnotation();
  const revolutionAxes = useRevolutionAxes();
  const profiles = useProfileAnnotations({
    excludeIds: annotation?.id ? [annotation.id] : [],
  });
  // Entries may be gated on the annotation's own data (e.g. shell shapes only
  // when profileLines exist).
  const staticOptions = getShape3DOptionsForType(annotation?.type).filter(
    (o) => !o.isAvailable || o.isAvailable(annotation)
  );

  // state

  const [anchorEl, setAnchorEl] = useState(null);
  const [busy, setBusy] = useState(false);

  // helpers

  if (!annotation) return null;

  const showProfilesSection =
    annotation.type === "POLYLINE" && profiles.length > 0;

  const typeSupportsRevolution = TYPES_SUPPORTING_REVOLUTION.includes(
    annotation.type
  );
  const showRevolutionSection =
    typeSupportsRevolution && revolutionAxes.length > 0;

  // Hide the chip entirely when there is nothing to pick.
  if (
    staticOptions.length === 0 &&
    !showProfilesSection &&
    !showRevolutionSection
  )
    return null;

  const currentKey = getShape3DKey(annotation.shape3D);
  const currentAxisAnnotationId = annotation.shape3D?.axisAnnotationId ?? null;
  // Profile drawings applied on this line (profileLines[i].sourceAnnotationId).
  const appliedSourceIds = getAppliedProfileSourceIds(annotation);

  let chipLabel = DEFAULT_LABEL;
  if (currentKey === "EXTRUSION_PROFILE") {
    chipLabel = LEGACY_TEMPLATE_PROFILE_LABEL;
  } else if (currentKey === "REVOLUTION") {
    const axe = revolutionAxes.find((a) => a.id === currentAxisAnnotationId);
    chipLabel = axe?.label ? `Révolution · ${axe.label}` : "Révolution";
  } else if (currentKey != null) {
    const entry = staticOptions.find((o) => o.key === currentKey);
    chipLabel = entry?.label ?? DEFAULT_LABEL;
  } else if (appliedSourceIds.size > 0) {
    chipLabel = getAppliedProfileChipLabel(appliedSourceIds, profiles);
  } else if (getEffectiveShellMode(annotation) === "DOME") {
    // Profiles present with no explicit shape3D → the DOME shell is the
    // effective default; surface it on the chip.
    chipLabel =
      staticOptions.find((o) => o.key === "SHELL_DOME")?.label ?? DEFAULT_LABEL;
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
    await updateAnnotation({
      id: annotation.id,
      shape3D: mergeShape3DOptions(annotation.shape3D, value),
    });
    handleClose();
  }

  async function handleToggleProfile(sourceAnnotationId) {
    if (busy) return;
    setBusy(true);
    handleClose();
    try {
      const { removed, failed } = await toggleProfileSourceOnAnnotationsService(
        {
          annotationIds: [annotation.id],
          sourceAnnotationId,
          dispatch,
        }
      );
      if (failed > 0) {
        dispatch(
          setToaster({ message: APPLY_FAILED_LABEL, severity: "warning" })
        );
      } else if (removed > 0) {
        dispatch(setToaster({ message: REMOVED_LABEL, severity: "success" }));
      }
    } catch (e) {
      console.error("[shape3D] toggle profile", e);
      dispatch(setToaster({ message: APPLY_FAILED_LABEL, severity: "error" }));
    } finally {
      setBusy(false);
    }
  }

  // render

  const isDefaultSelected = currentKey === null && appliedSourceIds.size === 0;
  const isStaticSelected = (key) => currentKey === key;
  const isRevolutionSelected = (axisId) =>
    currentKey === "REVOLUTION" && currentAxisAnnotationId === axisId;
  const profileStateOf = (id) => (appliedSourceIds.has(id) ? "all" : "none");

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
          {isDefaultSelected && (
            <ListItemIcon>
              <Check fontSize="small" />
            </ListItemIcon>
          )}
          <ListItemText inset={!isDefaultSelected}>
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

        {showProfilesSection &&
          MenuSectionProfileTiles({
            profiles,
            stateOf: profileStateOf,
            onToggle: handleToggleProfile,
            disabled: busy,
          })}

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
    </>
  );
}

Shape3DSelector.propTypes = {
  annotation: PropTypes.shape({
    id: PropTypes.string,
    type: PropTypes.string,
    shape3D: PropTypes.shape({
      key: PropTypes.string,
      axisAnnotationId: PropTypes.string,
    }),
    profileLines: PropTypes.array,
  }),
};
