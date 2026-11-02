import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Skeleton,
  Typography,
} from "@mui/material";

import CommandBadges from "./CommandBadges";
import commandHelperMarkdownComponents from "./commandHelperMarkdownComponents";
import useDataImageUrl from "Features/appConfig/hooks/useDataImageUrl";
import resolveTutorialImagePath from "Features/tutorial/utils/resolveTutorialImagePath";

// Helper of one command (« i » of the « Commandes » dialog): the gif of the
// org's Data/<org>/commands/<KEY>.md frontmatter (lazy, loaded on open) above
// its Markdown description. Nested over the full-page dialog: Escape closes
// it first (MUI), and useDialogQuitHotkey yields while it is open.
export default function DialogCommandHelper({
  open,
  command,
  helper,
  orgaCode,
  basePath,
  onClose,
}) {
  // strings

  const closeS = "Fermer";
  const gifNotFoundS = "Animation introuvable";

  // data

  const gifPath = helper?.gif
    ? resolveTutorialImagePath(helper.gif, basePath)
    : null;
  const { url: gifUrl, loading: gifLoading } = useDataImageUrl({
    orgaCode,
    relativePath: gifPath,
    enabled: open && Boolean(gifPath),
  });

  // helpers

  const Icon = command?.Icon;
  const renderedIcon = Icon ? <Icon /> : command?.icon;

  // render

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      {command && (
        <DialogTitle
          sx={{ display: "flex", alignItems: "center", gap: 1, pr: 2 }}
        >
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              color: "secondary.main",
              "& .MuiSvgIcon-root": { fontSize: 22 },
            }}
          >
            {renderedIcon}
          </Box>
          <Typography
            variant="h6"
            component="span"
            noWrap
            sx={{ flex: 1, minWidth: 0 }}
          >
            {command.label}
          </Typography>
          <CommandBadges command={command} />
        </DialogTitle>
      )}
      <DialogContent dividers>
        {gifPath && (
          <Box sx={{ mb: helper?.description ? 2 : 0 }}>
            {gifLoading ? (
              <Skeleton variant="rectangular" width="100%" height={240} />
            ) : gifUrl ? (
              <Box
                component="img"
                src={gifUrl}
                alt={command?.label ?? ""}
                sx={{
                  display: "block",
                  width: 1,
                  height: "auto",
                  borderRadius: 1,
                  border: "1px solid",
                  borderColor: "divider",
                  bgcolor: "common.white",
                }}
              />
            ) : (
              <Typography variant="body2" color="text.secondary">
                {gifNotFoundS}
              </Typography>
            )}
          </Box>
        )}
        {helper?.description && (
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={commandHelperMarkdownComponents}
            skipHtml
          >
            {helper.description}
          </ReactMarkdown>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{closeS}</Button>
      </DialogActions>
    </Dialog>
  );
}
