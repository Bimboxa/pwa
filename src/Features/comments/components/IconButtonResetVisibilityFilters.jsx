import { useDispatch, useSelector } from "react-redux";

import { setHiddenListingsIds } from "Features/listings/listingsSlice";
import { setHiddenAnnotationTemplateIds } from "Features/scopeVisibility/scopeVisibilitySlice";

import { Box, Tooltip } from "@mui/material";
import Refresh from "@mui/icons-material/Refresh";

import { COMMENT_COLORS } from "../commentsDarkTheme";

// Round "refresh" button next to the infos listing title (StripCommentPills):
// opening an info restores its view context, which hides listings and
// annotation templates — this button shows them all again. Dimmed when
// nothing is hidden.
export default function IconButtonResetVisibilityFilters({ size = 28 }) {
  const dispatch = useDispatch();

  // strings

  const tooltipS = "Réafficher toutes les listes et tous les modèles";

  // data

  const hasHiddenListings = useSelector(
    (s) => (s.listings.hiddenListingsIds?.length ?? 0) > 0
  );
  const hasHiddenTemplates = useSelector(
    (s) => s.scopeVisibility.hiddenAnnotationTemplateIds.length > 0
  );

  // helpers

  const disabled = !hasHiddenListings && !hasHiddenTemplates;

  // handlers

  function handleClick() {
    dispatch(setHiddenListingsIds([]));
    dispatch(setHiddenAnnotationTemplateIds([]));
  }

  // render

  return (
    <Tooltip title={tooltipS} arrow placement="right">
      {/* span: the tooltip still shows on the disabled button */}
      <Box component="span" sx={{ display: "flex", pointerEvents: "auto" }}>
        <Box
          component="button"
          type="button"
          disabled={disabled}
          onClick={handleClick}
          sx={{
            flexShrink: 0,
            width: size,
            height: size,
            p: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            borderRadius: "50%",
            border: `1px solid ${COMMENT_COLORS.borderStrong}`,
            bgcolor: COMMENT_COLORS.background,
            color: COMMENT_COLORS.text,
            boxShadow: "0 4px 16px rgba(0,0,0,0.35)",
            cursor: "pointer",
            "&:hover": { bgcolor: COMMENT_COLORS.surfaceRaised },
            "&:disabled": {
              color: COMMENT_COLORS.textSecondary,
              cursor: "default",
              bgcolor: COMMENT_COLORS.background,
            },
          }}
        >
          <Refresh sx={{ fontSize: 16 }} />
        </Box>
      </Box>
    </Tooltip>
  );
}
