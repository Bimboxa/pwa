import { useCallback, useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";

import { setIsLocatingComment } from "../commentsSlice";

import { Box, Typography } from "@mui/material";
import { ThemeProvider } from "@mui/material/styles";

import StripCommentPills from "./StripCommentPills";
import LayerCommentPins from "./LayerCommentPins";
import PopperComment from "./PopperComment";
import DialogCreateCommentListing from "./DialogCreateCommentListing";
import PortalEditorFloatingPanels from "Features/layout/components/PortalEditorFloatingPanels";

import commentsDarkTheme, { COMMENT_COLORS } from "../commentsDarkTheme";
import { COMMENTS_MODULE_KEY } from "../constants/commentEntityModel";
import useCommentListings from "../hooks/useCommentListings";
import useComments from "../hooks/useComments";
import useCanEditComments from "../hooks/useCanEditComments";
import useCommentLocateCapture from "../hooks/useCommentLocateCapture";

function LayerCommentsContent() {
  const dispatch = useDispatch();

  // strings

  const locateHintS = "Cliquez dans la vue pour localiser le commentaire";
  const locateEscS = "Échap pour annuler";
  const locateMissS =
    "Rien à localiser ici : cliquez sur le plan ou sur une surface";

  // data

  const { commentListings, selectedListing } = useCommentListings();
  const comments = useComments({ listingId: selectedListing?.id });
  const canEdit = useCanEditComments();
  const isLocating = useSelector((s) => s.comments.isLocating);

  // state

  const [missed, setMissed] = useState(false);

  // helpers

  const locating = Boolean(isLocating && canEdit);
  const handleMiss = useCallback(() => setMissed(true), []);
  useCommentLocateCapture({ active: locating, onMiss: handleMiss });

  // effects

  // The pick only lives in the Comments module: leaving it (or losing the
  // edit rights) disarms it.
  useEffect(() => {
    if (isLocating && !canEdit) dispatch(setIsLocatingComment(false));
  }, [isLocating, canEdit, dispatch]);

  useEffect(() => {
    if (!locating) setMissed(false);
  }, [locating]);

  useEffect(
    () => () => {
      dispatch(setIsLocatingComment(false));
    },
    [dispatch]
  );

  // render

  return (
    <>
      <ThemeProvider theme={commentsDarkTheme}>
        <Box
          sx={{
            position: "absolute",
            inset: 0,
            zIndex: 8,
            pointerEvents: "none",
          }}
        >
          <LayerCommentPins comments={comments} />
          <StripCommentPills
            comments={comments}
            commentListings={commentListings}
            selectedListing={selectedListing}
          />
          {locating && (
            <Box
              sx={{
                position: "absolute",
                top: 12,
                left: "50%",
                transform: "translateX(-50%)",
                zIndex: 11,
                display: "flex",
                alignItems: "baseline",
                gap: 1,
                px: 1.5,
                py: 0.75,
                borderRadius: 2,
                border: `1px solid ${COMMENT_COLORS.accent}`,
                bgcolor: COMMENT_COLORS.background,
                boxShadow: "0 4px 16px rgba(0,0,0,0.35)",
              }}
            >
              <Typography variant="body2" sx={{ color: COMMENT_COLORS.text }}>
                {missed ? locateMissS : locateHintS}
              </Typography>
              <Typography
                variant="caption"
                sx={{ color: COMMENT_COLORS.textSecondary }}
              >
                {locateEscS}
              </Typography>
            </Box>
          )}
        </Box>

        {/* Floating panel of the opened comment: rendered in the layout host
            (over the top bar when dragged), laid over the editors area. */}
        <PortalEditorFloatingPanels>
          <PopperComment comments={comments} canEdit={canEdit} />
        </PortalEditorFloatingPanels>
      </ThemeProvider>

      {canEdit && <DialogCreateCommentListing />}
    </>
  );
}

// Comments shown over the displayed editor (2D or 3D): the pills strip, the
// pins of the located comments and the floating panel of the opened comment.
// Mounted in the Comments module (where comments are written) and in the
// Viewer module — hence in a Krto shared with `?mode=viewer` — where they
// guide the reader.
export default function LayerComments() {
  // data

  const moduleKey = useSelector((s) => s.viewers.selectedViewerKey);

  // render

  if (moduleKey !== COMMENTS_MODULE_KEY && moduleKey !== "THREED") return null;
  return <LayerCommentsContent />;
}
