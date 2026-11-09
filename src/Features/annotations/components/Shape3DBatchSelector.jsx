import { useState } from "react";
import PropTypes from "prop-types";
import { useDispatch } from "react-redux";

import { setToaster } from "Features/layout/layoutSlice";

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
import useProfileAnnotations from "../hooks/useProfileAnnotations";
import useRevolutionAxes from "../hooks/useRevolutionAxes";
import {
  getShape3DKey,
  mergeShape3DOptions,
  TYPES_SUPPORTING_REVOLUTION,
} from "../constants/shape3DConfig";
import MenuSectionProfileTiles from "./MenuSectionProfileTiles";
import toggleProfileSourceOnAnnotationsService from "Features/elevation/services/toggleProfileSourceOnAnnotationsService";
import getAppliedProfileSourceIds, {
  getAppliedProfileChipLabel,
  profileSourceIdsSignature,
} from "../utils/getAppliedProfileSourceIds";

const DEFAULT_LABEL = "Forme par défaut";
const MIXED_LABEL = "Formes variables";
const LEGACY_TEMPLATE_PROFILE_LABEL = "Profil (modèle)";
const APPLY_FAILED_LABEL = "Profil non appliqué (géométrie insuffisante)";
const REMOVED_LABEL = "Profil retiré (Ctrl+Z pour annuler)";

// Stable signature of a shape3D value, used to detect whether the current
// selection shares a single shape3D (uniform) or mixes several (mixed).
function shape3DSignature(shape3D) {
  const key = getShape3DKey(shape3D);
  if (key === "REVOLUTION")
    return `REVOLUTION:${shape3D?.axisAnnotationId ?? ""}`;
  return key ?? "DEFAULT";
}

// Batch counterpart of Shape3DSelector: assigns a shape3D to every selected
// annotation at once (mainly a REVOLUTION around the same axis for several
// POLYLINEs), and toggles a profile DRAWING on every selected POLYLINE (tiles
// — toggleProfileSourceOnAnnotationsService: applied on the lines lacking
// it, removed from all when all carry it). A chosen shape is only applied to
// the annotations whose type supports it.
export default function Shape3DBatchSelector({ annotations }) {
  const dispatch = useDispatch();

  // data

  const updateAnnotations = useUpdateAnnotations();
  const revolutionAxes = useRevolutionAxes();
  const profiles = useProfileAnnotations({
    excludeIds: (annotations ?? []).map((a) => a.id),
  });

  // state

  const [anchorEl, setAnchorEl] = useState(null);
  const [busy, setBusy] = useState(false);

  // helpers

  if (!annotations || annotations.length === 0) return null;

  const polylineTargets = annotations.filter((a) => a.type === "POLYLINE");
  const someSupportRevolution = annotations.some((a) =>
    TYPES_SUPPORTING_REVOLUTION.includes(a.type)
  );

  const showProfilesSection = polylineTargets.length > 0 && profiles.length > 0;
  const showRevolutionSection =
    someSupportRevolution && revolutionAxes.length > 0;

  // Nothing assignable across the selection → hide entirely.
  if (!showProfilesSection && !showRevolutionSection) return null;

  // Uniform vs mixed selection (drives the chip label and the check marks).
  const signatures = new Set(
    annotations.map((a) => shape3DSignature(a.shape3D))
  );
  const isUniform = signatures.size === 1;
  const refShape3D = isUniform ? annotations[0]?.shape3D : null;
  const currentKey = isUniform ? getShape3DKey(refShape3D) : undefined;
  const currentAxisAnnotationId = refShape3D?.axisAnnotationId ?? null;

  // Profile drawings applied per POLYLINE target; "uniform" when every
  // POLYLINE carries exactly the same set of sources.
  const appliedByTarget = polylineTargets.map((a) =>
    getAppliedProfileSourceIds(a)
  );
  const appliedSignatures = new Set(
    appliedByTarget.map(profileSourceIdsSignature)
  );
  const profilesUniform = appliedSignatures.size <= 1;
  const uniformAppliedIds = profilesUniform
    ? (appliedByTarget[0] ?? new Set())
    : new Set();

  let chipLabel = MIXED_LABEL;
  if (isUniform) {
    if (currentKey === "EXTRUSION_PROFILE") {
      chipLabel = LEGACY_TEMPLATE_PROFILE_LABEL;
    } else if (currentKey === "REVOLUTION") {
      const axe = revolutionAxes.find((a) => a.id === currentAxisAnnotationId);
      chipLabel = axe?.label ? `Révolution · ${axe.label}` : "Révolution";
    } else if (currentKey === null && uniformAppliedIds.size > 0) {
      chipLabel = getAppliedProfileChipLabel(uniformAppliedIds, profiles);
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
    } else {
      // Default shape (null) clears the override on every selected annotation.
      targets = annotations;
    }
    const updates = targets.map((a) => ({
      id: a.id,
      shape3D: mergeShape3DOptions(a.shape3D, value),
    }));
    await updateAnnotations(updates);
    handleClose();
  }

  async function handleToggleProfile(sourceAnnotationId) {
    if (busy) return;
    setBusy(true);
    handleClose();
    try {
      const { removed, failed } = await toggleProfileSourceOnAnnotationsService(
        {
          annotationIds: polylineTargets.map((a) => a.id),
          sourceAnnotationId,
          dispatch,
        }
      );
      if (failed > 0) {
        dispatch(
          setToaster({
            message:
              failed === 1
                ? APPLY_FAILED_LABEL
                : `${failed} lignes : ${APPLY_FAILED_LABEL.toLowerCase()}`,
            severity: "warning",
          })
        );
      } else if (removed > 0) {
        dispatch(setToaster({ message: REMOVED_LABEL, severity: "success" }));
      }
    } catch (e) {
      console.error("[shape3D] batch toggle profile", e);
      dispatch(setToaster({ message: APPLY_FAILED_LABEL, severity: "error" }));
    } finally {
      setBusy(false);
    }
  }

  // render

  const isRevolutionSelected = (axisId) =>
    isUniform &&
    currentKey === "REVOLUTION" &&
    currentAxisAnnotationId === axisId;
  const isDefaultSelected =
    isUniform && currentKey === null && uniformAppliedIds.size === 0;
  const profileStateOf = (id) => {
    const count = appliedByTarget.filter((ids) => ids.has(id)).length;
    if (count === 0) return "none";
    return count === appliedByTarget.length ? "all" : "some";
  };

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
      </Box>
    </>
  );
}

Shape3DBatchSelector.propTypes = {
  annotations: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.string,
      type: PropTypes.string,
      shape3D: PropTypes.shape({
        key: PropTypes.string,
        axisAnnotationId: PropTypes.string,
      }),
      profileLines: PropTypes.array,
    })
  ),
};
