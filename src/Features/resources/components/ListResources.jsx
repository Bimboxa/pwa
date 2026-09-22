import {
  Avatar,
  Box,
  Chip,
  List,
  ListItemAvatar,
  ListItemButton,
  ListItemText,
} from "@mui/material";
import { InsertDriveFileOutlined } from "@mui/icons-material";

import stringifyFileSize from "Features/files/utils/stringifyFileSize";

import getResourceVisibility, {
  RESOURCE_VISIBILITY_LABELS,
} from "../utils/getResourceVisibility";
import getResourceSecondaryLabel from "../utils/getResourceSecondaryLabel";

export default function ListResources({
  resources,
  onResourceClick,
  isResourceDisabled,
}) {
  // render

  return (
    <List dense disablePadding>
      {resources.map((resource) => {
        const trigram = resource.createdBy?.trigram;
        const secondary = [
          getResourceSecondaryLabel(resource),
          stringifyFileSize(resource.fileSize),
          trigram,
        ]
          .filter(Boolean)
          .join(" · ");
        const showFileTypeLabel =
          resource.fileType && resource.fileType !== "OTHER";
        const visibility = getResourceVisibility(resource);
        return (
          <ListItemButton
            key={resource.id}
            divider
            disabled={isResourceDisabled?.(resource)}
            onClick={() => onResourceClick(resource)}
          >
            <ListItemAvatar>
              {resource.thumbnail ? (
                <Avatar
                  variant="rounded"
                  src={resource.thumbnail}
                  sx={{ width: 40, height: 40 }}
                />
              ) : (
                <Avatar
                  variant="rounded"
                  sx={{
                    width: 40,
                    height: 40,
                    bgcolor: "background.default",
                    color: "text.secondary",
                    fontSize: 11,
                    fontWeight: 600,
                    border: (theme) => `1px solid ${theme.palette.divider}`,
                  }}
                >
                  {showFileTypeLabel ? (
                    resource.fileType
                  ) : (
                    <InsertDriveFileOutlined fontSize="small" />
                  )}
                </Avatar>
              )}
            </ListItemAvatar>
            <ListItemText
              primary={resource.name}
              secondary={secondary}
              primaryTypographyProps={{ variant: "body2", noWrap: true }}
              secondaryTypographyProps={{ noWrap: true }}
            />
            <Box sx={{ ml: 1, flexShrink: 0 }}>
              <Chip
                size="small"
                variant="outlined"
                label={RESOURCE_VISIBILITY_LABELS[visibility]}
                sx={{ fontSize: 10, height: 20 }}
              />
            </Box>
          </ListItemButton>
        );
      })}
    </List>
  );
}
