import { useLiveQuery } from "dexie-react-hooks";

import { Box, IconButton, InputBase, Tooltip } from "@mui/material";
import { alpha } from "@mui/material/styles";

import db from "App/db/db";

import CommentBlockDrawAction from "./CommentBlockDrawAction";

import { COMMENT_COLORS } from "../commentsDarkTheme";
import getCommentDrawActionTools from "../utils/getCommentDrawActionTools";

// DRAW_ACTION block in the editor flow: the button as the reader will see it
// (inert), then the tool it arms — one icon per tool of the template's shape,
// the armed one lit — and its optional label (the template's by default).
export default function CommentBlockDrawActionEditor({ block, onChange }) {
  // strings

  const labelS = "Libellé du bouton (nom du modèle par défaut)…";

  // data

  const templateId = block.annotationTemplateId ?? null;
  const template = useLiveQuery(async () => {
    if (!templateId) return null;
    const row = await db.annotationTemplates.get(templateId);
    return row && !row.deletedAt ? row : null;
  }, [templateId]);

  // helpers

  const { tools, activeTool } = getCommentDrawActionTools(
    template,
    block.toolKey
  );

  // render

  return (
    <>
      <CommentBlockDrawAction block={block} interactive={false} />
      {tools.length > 1 && (
        <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.25, mt: 0.5 }}>
          {tools.map((tool) => {
            const active = tool.key === activeTool?.key;
            return (
              <Tooltip key={tool.key} title={tool.label} arrow>
                <IconButton
                  size="small"
                  onClick={() => onChange({ toolKey: tool.key })}
                  sx={{
                    p: 0.5,
                    borderRadius: 1,
                    color: active
                      ? COMMENT_COLORS.accentText
                      : COMMENT_COLORS.textSecondary,
                    bgcolor: active
                      ? alpha(COMMENT_COLORS.accent, 0.45)
                      : "transparent",
                    "&:hover": { color: COMMENT_COLORS.text },
                  }}
                >
                  <tool.Icon sx={{ fontSize: 16 }} />
                </IconButton>
              </Tooltip>
            );
          })}
        </Box>
      )}
      <InputBase
        fullWidth
        placeholder={labelS}
        value={block.label ?? ""}
        onChange={(e) => onChange({ label: e.target.value })}
        sx={{ mt: 0.25, p: 0, fontSize: 12, color: "text.secondary" }}
      />
    </>
  );
}
