import { useDispatch, useSelector } from "react-redux";

import { Box, IconButton, Tooltip, Typography } from "@mui/material";
import BugReportIcon from "@mui/icons-material/BugReport";

import { toggleAnnotationTemplateHidden } from "Features/scopeVisibility/scopeVisibilitySlice";
import { selectHiddenAnnotationTemplateIdSet } from "Features/scopeVisibility/selectors/scopeVisibilitySelectors";

import ButtonCountPill from "Features/popperMapListings/components/ButtonCountPill";
import useMainBaseMap from "Features/mapEditor/hooks/useMainBaseMap";
import stringifyAnnotationData from "Features/annotations/utils/stringifyAnnotationData";
import { CUT_LINES_TEMPLATE_ID } from "Features/annotations/utils/templatelessAnnotations";

import IconCutLineTrace from "./IconCutLineTrace";

// ---------------------------------------------------------------------------
// RowCutLineAnnotations — « Lignes de coupe » row of the PopperMapListings,
// pinned at the top of the panel above « Annotations sans modèle », in the
// same white rounded card: the CUT_LINE annotations (Maillage module,
// Features/threedCutLines) of the popper's annotations set. On the right:
//   - a light grey debug button copying their data to the clipboard (same
//     payload as the 🐛 button of the multi-selection toolbar:
//     { imageSize, meterByPx, annotations } with the resolved px points —
//     `derived` / `stop` flags and offsets included);
//   - the count pill, toggling their visibility (sentinel template id
//     CUT_LINES_TEMPLATE_ID in the hidden templates list — filled while
//     visible, outlined while hidden, as on the listing rows).
// Rendered only when there is at least one, or while eye-hidden.
// ---------------------------------------------------------------------------

export default function RowCutLineAnnotations({ annotations }) {
  // strings

  const labelS = "Lignes de coupe";
  const copyS = "Copier les données des lignes de coupe (debug)";
  const hideS = "Masquer les lignes de coupe";
  const showS = "Afficher les lignes de coupe";

  // data

  const dispatch = useDispatch();
  const baseMap = useMainBaseMap();
  const hiddenIdSet = useSelector(selectHiddenAnnotationTemplateIdSet);
  const isHidden = hiddenIdSet.has(CUT_LINES_TEMPLATE_ID);

  // helpers

  const count = annotations?.length ?? 0;

  // handlers

  const handleCopy = (e) => {
    e.stopPropagation();
    if (count === 0) return;
    const data = stringifyAnnotationData({
      imageSize: baseMap?.getImageSize?.() ?? baseMap?.imageSize ?? null,
      meterByPx: baseMap?.getMeterByPx?.() ?? baseMap?.meterByPx ?? null,
      annotations,
    });
    navigator.clipboard?.writeText(data);
  };

  const handleToggleHidden = (e) => {
    e.stopPropagation();
    dispatch(toggleAnnotationTemplateHidden(CUT_LINES_TEMPLATE_ID));
  };

  // render

  if (count === 0 && !isHidden) return null;

  return (
    <Box
      sx={{
        mx: 1,
        my: 1,
        overflow: "hidden",
        bgcolor: "background.paper",
        border: "1px solid",
        borderColor: "panel.border",
        borderRadius: 2,
      }}
    >
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 1,
          pl: 1,
          pr: 0.5,
          py: 0.5,
        }}
      >
        <IconCutLineTrace
          sx={{
            fontSize: 20,
            color: isHidden ? "text.disabled" : "secondary.fluo",
            flexShrink: 0,
          }}
        />
        <Typography
          variant="body2"
          noWrap
          sx={{
            flex: 1,
            minWidth: 0,
            userSelect: "none",
            fontStyle: "italic",
            color: isHidden ? "text.disabled" : "panel.textSecondary",
          }}
        >
          {labelS}
        </Typography>

        <Tooltip title={copyS} arrow>
          <span>
            <IconButton
              size="small"
              disabled={count === 0}
              onMouseDown={(e) => e.stopPropagation()}
              onClick={handleCopy}
              sx={{
                flexShrink: 0,
                color: "text.disabled",
                opacity: 0.4,
                "&:hover": { opacity: 1, bgcolor: "action.hover" },
              }}
            >
              <BugReportIcon sx={{ fontSize: 16 }} />
            </IconButton>
          </span>
        </Tooltip>

        <ButtonCountPill
          count={count}
          hidden={isHidden}
          title={isHidden ? showS : hideS}
          onClick={handleToggleHidden}
        />
      </Box>
    </Box>
  );
}
