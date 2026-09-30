import { useDispatch, useSelector } from "react-redux";

import { clearSelection } from "Features/selection/selectionSlice";
import { setHideEmptyBaseMapsInList } from "Features/popperMapListings/popperMapListingsSlice";
import {
  setHideBaseMapImageInViewer,
  setHideAnnotationsInViewer,
} from "Features/viewers/viewersSlice";
import {
  setHideBaseMaps,
  setHideAnnotationsIn3d,
  setBaseMapOpacityIn3d,
  setAnnotationsModeByBaseMapIdIn3d,
} from "Features/threedEditor/threedEditorSlice";

import {
  Box,
  IconButton,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
} from "@mui/material";
import { ArrowBack as Back } from "@mui/icons-material";

import BoxFlexVStretch from "Features/layout/components/BoxFlexVStretch";
import WhiteSectionGeneric from "Features/form/components/WhiteSectionGeneric";
import FieldCheck from "Features/form/components/FieldCheck";
import FieldSlider from "Features/form/components/FieldSlider";

import useSelectedScope from "Features/scopes/hooks/useSelectedScope";
import useBaseMaps from "Features/baseMaps/hooks/useBaseMaps";
import useMainBaseMap from "Features/mapEditor/hooks/useMainBaseMap";
import useDisabledBaseMapListingIds from "Features/baseMapEditor/hooks/useDisabledBaseMapListingIds";
import { selectEffectiveViewerKey } from "Features/viewers/utils/effectiveViewerKey";
import { isThreedFamilyViewerKey } from "Features/viewers/utils/threedViewerKeys";
import {
  ANNOTATIONS_DISPLAY_MODE,
  ANNOTATIONS_DISPLAY_MODE_OPTIONS,
} from "Features/threedEditor/constants/annotationsDisplayModeIn3d";

// ---------------------------------------------------------------------------
// PanelPropertiesBaseMapsList — right-panel properties of the "Fonds de plan"
// side of the popper (Tune button). Global visibility settings of the
// displayed editor, complementing the per-row toggles of the list:
// - 2D: main base map image / annotations flags (viewers slice);
// - 3D: every base map image / annotation, base maps opacity, and the bulk
//   display mode of the OTHER base maps' annotations (NONE / NORMAL / DIMMED,
//   applied to every non-main base map of the scope at once);
// - list: hide the base maps without annotations.
// ---------------------------------------------------------------------------

export default function PanelPropertiesBaseMapsList() {
  const dispatch = useDispatch();

  // strings

  const titleS = "Fonds de plan";
  const visibilityS = "Visibilité";
  const listS = "Liste";
  const hideImage2dS = "Masquer l'image du fond de plan";
  const hideAnnotations2dS = "Masquer les annotations";
  const hideImages3dS = "Masquer les fonds de plan";
  const hideAnnotations3dS = "Masquer toutes les annotations";
  const opacityS = "Opacité";
  const othersModeS = "Annotations des autres fonds de plan";
  const hideEmptyS = "Masquer les fonds de plan sans annotation";

  // data

  const { value: scope } = useSelectedScope();
  const effectiveViewerKey = useSelector(selectEffectiveViewerKey);
  const isThreedDisplayed = isThreedFamilyViewerKey(effectiveViewerKey);

  const hideImageInViewer = useSelector(
    (s) => s.viewers.hideBaseMapImageInViewer
  );
  const hideAnnotationsInViewer = useSelector(
    (s) => s.viewers.hideAnnotationsInViewer
  );
  const hideBaseMaps = useSelector((s) => s.threedEditor.hideBaseMaps);
  const hideAnnotationsIn3d = useSelector(
    (s) => s.threedEditor.hideAnnotationsIn3d
  );
  const opacity = useSelector((s) => s.threedEditor.baseMapOpacityIn3d ?? 1);
  const annotationsModeByBaseMapId = useSelector(
    (s) => s.threedEditor.annotationsModeByBaseMapIdIn3d
  );
  const hideEmpty = useSelector(
    (s) => s.popperMapListings.hideEmptyBaseMapsInList
  );

  const { value: baseMaps = [] } = useBaseMaps({});
  const mainBaseMap = useMainBaseMap();
  const { disabledListingIds } = useDisabledBaseMapListingIds();

  // helpers

  const scopeName = scope?.name ?? "-?-";

  // Non-main base maps of the scope (same set as the list).
  const otherBaseMaps = baseMaps.filter(
    (bm) =>
      bm.id !== mainBaseMap?.id && !disabledListingIds.includes(bm.listingId)
  );
  // Common display mode of the others (null when mixed).
  const modes = new Set(
    otherBaseMaps.map(
      (bm) =>
        annotationsModeByBaseMapId?.[bm.id] ?? ANNOTATIONS_DISPLAY_MODE.NONE
    )
  );
  const othersMode = modes.size === 1 ? [...modes][0] : null;

  // handlers

  function handleOthersModeChange(_e, mode) {
    if (!mode) return;
    const next = { ...(annotationsModeByBaseMapId ?? {}) };
    otherBaseMaps.forEach((bm) => {
      if (mode === ANNOTATIONS_DISPLAY_MODE.NONE) delete next[bm.id];
      else next[bm.id] = mode;
    });
    dispatch(setAnnotationsModeByBaseMapIdIn3d(next));
  }

  // render

  if (!scope) return null;

  const cardTitleSx = {
    fontWeight: 700,
    fontSize: "0.7rem",
    textTransform: "uppercase",
    color: "text.secondary",
    letterSpacing: 0.5,
    mb: 0.5,
    display: "block",
  };

  return (
    <BoxFlexVStretch>
      {/* Header */}
      <Box sx={{ display: "flex", alignItems: "center", p: 0.5, pl: 1 }}>
        <IconButton onClick={() => dispatch(clearSelection())}>
          <Back />
        </IconButton>
        <Box sx={{ ml: 1 }}>
          <Typography variant="caption" sx={{ color: "text.secondary" }}>
            {titleS}
          </Typography>
          <Typography variant="body2" sx={{ fontWeight: "bold" }}>
            {scopeName}
          </Typography>
        </Box>
      </Box>

      {/* Content */}
      <BoxFlexVStretch sx={{ overflowY: "auto", p: 1.5, gap: 1 }}>
        {/* Card: visibility of the displayed editor */}
        <WhiteSectionGeneric>
          <Typography variant="caption" sx={cardTitleSx}>
            {visibilityS}
          </Typography>
          {isThreedDisplayed ? (
            <>
              <FieldCheck
                value={hideBaseMaps}
                onChange={(v) => dispatch(setHideBaseMaps(v))}
                label={hideImages3dS}
                options={{ type: "check", showAsInline: true }}
              />
              <FieldCheck
                value={hideAnnotationsIn3d}
                onChange={(v) => dispatch(setHideAnnotationsIn3d(v))}
                label={hideAnnotations3dS}
                options={{ type: "check", showAsInline: true }}
              />
              <FieldSlider
                label={opacityS}
                value={opacity}
                onChange={(v) => dispatch(setBaseMapOpacityIn3d(v))}
              />
              <Box
                sx={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 1,
                  px: 1,
                  py: 0.5,
                }}
              >
                <Typography variant="body2" sx={{ minWidth: 0 }}>
                  {othersModeS}
                </Typography>
                <ToggleButtonGroup
                  exclusive
                  size="small"
                  value={othersMode}
                  onChange={handleOthersModeChange}
                  disabled={otherBaseMaps.length === 0}
                >
                  {ANNOTATIONS_DISPLAY_MODE_OPTIONS.map(
                    ({ mode, tooltip, Icon }) => (
                      <Tooltip key={mode} title={tooltip}>
                        <ToggleButton value={mode} sx={{ p: 0.4 }}>
                          <Icon sx={{ fontSize: 16 }} />
                        </ToggleButton>
                      </Tooltip>
                    )
                  )}
                </ToggleButtonGroup>
              </Box>
            </>
          ) : (
            <>
              <FieldCheck
                value={hideImageInViewer}
                onChange={(v) => dispatch(setHideBaseMapImageInViewer(v))}
                label={hideImage2dS}
                options={{ type: "check", showAsInline: true }}
              />
              <FieldCheck
                value={hideAnnotationsInViewer}
                onChange={(v) => dispatch(setHideAnnotationsInViewer(v))}
                label={hideAnnotations2dS}
                options={{ type: "check", showAsInline: true }}
              />
            </>
          )}
        </WhiteSectionGeneric>

        {/* Card: list options */}
        <WhiteSectionGeneric>
          <Typography variant="caption" sx={cardTitleSx}>
            {listS}
          </Typography>
          <FieldCheck
            value={hideEmpty}
            onChange={(v) => dispatch(setHideEmptyBaseMapsInList(v))}
            label={hideEmptyS}
            options={{ type: "check", showAsInline: true }}
          />
        </WhiteSectionGeneric>
      </BoxFlexVStretch>
    </BoxFlexVStretch>
  );
}
