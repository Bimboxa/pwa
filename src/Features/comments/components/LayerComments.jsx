import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useDispatch, useSelector } from "react-redux";

import { setIsLocatingComment } from "../commentsSlice";

import { Box, Typography } from "@mui/material";
import { ThemeProvider } from "@mui/material/styles";

import StripCommentPills from "./StripCommentPills";
import LayerCommentPins from "./LayerCommentPins";
import CommentLocateCursor from "./CommentLocateCursor";
import PopperComment from "./PopperComment";
import DialogCreateCommentListing from "./DialogCreateCommentListing";
import PortalEditorFloatingPanels from "Features/layout/components/PortalEditorFloatingPanels";

import commentsDarkTheme, { COMMENT_COLORS } from "../commentsDarkTheme";
import { COMMENTS_MODULE_KEY } from "../constants/commentEntityModel";
import useCommentListings from "../hooks/useCommentListings";
import useComments from "../hooks/useComments";
import useCanEditComments from "../hooks/useCanEditComments";
import useCommentLocateCapture from "../hooks/useCommentLocateCapture";
import useEditorCommentPins from "../hooks/useEditorCommentPins";
import useMainBaseMap from "Features/mapEditor/hooks/useMainBaseMap";
import isCommentInBlocksContext from "../utils/isCommentInBlocksContext";
import isCommandsToolbarModuleKey from "Features/commandsToolbar/utils/isCommandsToolbarModuleKey";
import { selectDisabledModuleKeys } from "Features/scopeConfig/utils/scopeConfigSelectors";

// `withPins`: the module displays the shared 2D / 3D editors the pins are
// projected on.
function LayerCommentsContent({ withPins }) {
  const dispatch = useDispatch();

  // strings

  const locateHintS = "Cliquez dans la vue pour localiser l'info";
  const locateEscS = "Échap pour annuler";
  const locateMissS =
    "Rien à localiser ici : cliquez sur le plan ou sur une surface";

  // data

  const { commentListings, selectedListing } = useCommentListings();
  const allComments = useComments({ listingId: selectedListing?.id });
  // Blocks context: on a blocks base map, the infos written there alone;
  // on a regular one, none of them. The numbers stay the listing's ones.
  const mainBaseMap = useMainBaseMap();
  const isBlocksContext = Boolean(mainBaseMap?.isBlocksBaseMap);
  const openedCommentId = useSelector((s) => s.comments.openedCommentId);
  const comments = useMemo(
    () =>
      allComments.filter((c) => isCommentInBlocksContext(c, isBlocksContext)),
    [allComments, isBlocksContext]
  );
  // The opened info stays readable whatever the context (opened from the
  // Infos panel without a main base map switch).
  const popperComments = useMemo(
    () =>
      allComments.filter(
        (c) =>
          c.id === openedCommentId ||
          isCommentInBlocksContext(c, isBlocksContext)
      ),
    [allComments, isBlocksContext, openedCommentId]
  );
  const { canEdit, canLocate } = useCanEditComments();
  const isLocating = useSelector((s) => s.comments.isLocating);
  const pinsHidden = useSelector((s) => s.comments.pinsHidden);
  // A drawing / tool mode is armed: the strip, the pins and the floating
  // panel step aside (the drawing helper and its toolbar take the screen, and
  // a pin must not take a click of the drawing).
  const isDrawing = useSelector((s) => Boolean(s.mapEditor.enabledDrawingMode));
  const editorPins = useEditorCommentPins(comments);

  // state

  const [missed, setMissed] = useState(false);

  // helpers

  const locating = Boolean(isLocating && canLocate);
  const locateCursorRef = useRef(null);
  const handleMiss = useCallback(() => setMissed(true), []);
  useCommentLocateCapture({
    active: locating,
    onMiss: handleMiss,
    cursorRef: locateCursorRef,
  });

  // effects

  // The pick only lives where infos are written: leaving such a module (or
  // losing the edit rights) disarms it.
  useEffect(() => {
    if (isLocating && !canLocate) dispatch(setIsLocatingComment(false));
  }, [isLocating, canLocate, dispatch]);

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
          {withPins && !pinsHidden && !isDrawing && (
            <LayerCommentPins pins={editorPins} />
          )}
          {!isDrawing && (
            <StripCommentPills
              comments={comments}
              commentListings={commentListings}
              selectedListing={selectedListing}
              canEdit={canEdit}
              canLocate={canLocate}
              pinsCount={withPins ? editorPins.length : null}
              pinsHidden={pinsHidden}
            />
          )}
          {locating && <CommentLocateCursor ref={locateCursorRef} />}
          {locating && (
            <Box
              sx={{
                position: "absolute",
                // below the top-centered comments bar (StripCommentPills)
                top: 52,
                left: "50%",
                transform: "translateX(-50%)",
                zIndex: 11,
                display: "flex",
                alignItems: "baseline",
                gap: 1,
                px: 1.5,
                py: 0.75,
                borderRadius: 2,
                border: `1px solid ${COMMENT_COLORS.accentText}`,
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
          <PopperComment
            comments={popperComments}
            canEdit={canEdit}
            hidden={isDrawing}
          />
        </PortalEditorFloatingPanels>
      </ThemeProvider>

      {canEdit && <DialogCreateCommentListing />}
    </>
  );
}

// Infos shown over the displayed module: the pills strip (with its two "add
// an info" buttons where infos are written — every module but the Viewer),
// the pins of the located infos over the 2D / 3D editors and the floating
// panel of the opened info.
// Mounted in the Infos module, in the Viewer module — hence in a Krto shared
// with `?mode=viewer` — where they guide the reader, and, while the Infos
// module is enabled in the scope, in EVERY other module: opening an info
// sends the reader to the module it was written from
// (restoreCommentViewContextService), the strip follows.
export default function LayerComments() {
  // data

  const moduleKey = useSelector((s) => s.viewers.selectedViewerKey);
  const commentsModuleEnabled = useSelector(
    (s) => !selectDisabledModuleKeys(s).includes(COMMENTS_MODULE_KEY)
  );

  // render

  const isInfosOrViewer =
    moduleKey === COMMENTS_MODULE_KEY || moduleKey === "THREED";
  if (!isInfosOrViewer && !commentsModuleEnabled) return null;
  return (
    <LayerCommentsContent
      withPins={isInfosOrViewer || isCommandsToolbarModuleKey(moduleKey)}
    />
  );
}
