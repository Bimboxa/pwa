import {
  Avatar,
  List,
  ListItemAvatar,
  ListItemButton,
  ListItemText,
} from "@mui/material";
import { InsertDriveFileOutlined } from "@mui/icons-material";

import stringifyFileSize from "Features/files/utils/stringifyFileSize";

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
        const secondary = [stringifyFileSize(resource.fileSize), trigram]
          .filter(Boolean)
          .join(" · ");
        const showFileTypeLabel =
          resource.fileType && resource.fileType !== "OTHER";
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
            />
          </ListItemButton>
        );
      })}
    </List>
  );
}
