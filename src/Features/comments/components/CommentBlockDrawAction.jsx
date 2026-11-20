import { useDispatch, useSelector, useStore } from "react-redux";
import { useLiveQuery } from "dexie-react-hooks";

import { setToaster } from "Features/layout/layoutSlice";

import { Box, ButtonBase, Tooltip, Typography } from "@mui/material";

import db from "App/db/db";

import AnnotationTemplateIcon from "Features/annotations/components/AnnotationTemplateIcon";

import { COMMENT_COLORS } from "../commentsDarkTheme";
import useReadOnlyScope from "Features/scopes/hooks/useReadOnlyScope";
import runCommentDrawActionService from "../services/runCommentDrawActionService";
import getCommentDrawActionTools from "../utils/getCommentDrawActionTools";

// DRAW_ACTION block of an info: a button that starts the drawing of an
// annotation template with a given tool, like a click on the template row of
// PopperMapListings (runCommentDrawActionService). Shows the template (icon +
// label, or the block's own label) and the tool that will be armed; lit while
// that template is being drawn.
// `interactive: false` (the block previewed in the editor) and the read-only
// contexts (shared `?mode=viewer` link, read-only scope) keep it inert.
export default function CommentBlockDrawAction({
  block,
  sourceModuleKey = null,
  interactive = true,
}) {
  const dispatch = useDispatch();
  const store = useStore();

  // strings

  const missingS = "Modèle d'annotation introuvable";
  const readOnlyS = "Dessin indisponible en lecture seule";
  const drawS = "Dessiner";

  // data

  const templateId = block.annotationTemplateId ?? null;
  // undefined while loading, null when the template is gone
  const template = useLiveQuery(async () => {
    if (!templateId) return null;
    const row = await db.annotationTemplates.get(templateId);
    return row && !row.deletedAt ? row : null;
  }, [templateId]);
  const viewerMode = useSelector((s) => s.urlParams.viewerMode);
  const { isReadOnly } = useReadOnlyScope();
  const isDrawing = useSelector(
    (s) =>
      Boolean(s.mapEditor.enabledDrawingMode) &&
      Boolean(templateId) &&
      s.annotations.newAnnotation?.annotationTemplateId === templateId
  );

  // helpers

  const { activeTool } = getCommentDrawActionTools(template, block.toolKey);
  const ToolIcon = activeTool?.Icon ?? null;
  const readOnly = Boolean(viewerMode || isReadOnly);
  const missing = template === null;
  const disabled = !interactive || readOnly || !template || !activeTool;
  const label = block.label?.trim() || template?.label || missingS;
  const tooltip = missing
    ? missingS
    : readOnly
      ? readOnlyS
      : activeTool
        ? `${drawS} — ${activeTool.label}`
        : "";

  // handlers

  async function handleClick() {
    const result = await runCommentDrawActionService({
      block,
      sourceModuleKey,
      dispatch,
      store,
    });
    if (!result.ok) {
      dispatch(setToaster({ message: result.reason, severity: "warning" }));
    }
  }

  // render

  return (
    <Tooltip title={interactive ? tooltip : ""} arrow placement="left">
      {/* span: a disabled button fires no pointer events for the tooltip */}
      <Box component="span" sx={{ display: "block" }}>
        <ButtonBase
          disabled={disabled}
          onClick={handleClick}
          sx={{
            width: 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "flex-start",
            gap: 1,
            px: 1.25,
            py: 0.75,
            borderRadius: 1.5,
            border: "1px solid",
            borderColor: isDrawing
              ? COMMENT_COLORS.accentText
              : COMMENT_COLORS.borderStrong,
            bgcolor: isDrawing
              ? COMMENT_COLORS.surfaceRaised
              : COMMENT_COLORS.surface,
            color: "text.primary",
            textAlign: "left",
            transition: "border-color 0.12s, background-color 0.12s",
            "&:hover": {
              borderColor: COMMENT_COLORS.accentText,
              bgcolor: COMMENT_COLORS.surfaceRaised,
            },
            // the editor preview stays fully readable; a real dead end dims
            "&.Mui-disabled": { opacity: interactive && !missing ? 0.6 : 1 },
          }}
        >
          <Box sx={{ flexShrink: 0, display: "flex" }}>
            <AnnotationTemplateIcon
              template={template}
              size={20}
              use3D={false}
            />
          </Box>
          <Typography
            variant="body2"
            sx={{
              flex: 1,
              minWidth: 0,
              fontWeight: 600,
              overflowWrap: "anywhere",
              color: missing ? "text.secondary" : "text.primary",
            }}
          >
            {label}
          </Typography>
          {ToolIcon && (
            <ToolIcon
              sx={{
                flexShrink: 0,
                fontSize: 18,
                color: COMMENT_COLORS.accentText,
              }}
            />
          )}
        </ButtonBase>
      </Box>
    </Tooltip>
  );
}
