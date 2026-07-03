import { Box, Typography, IconButton } from "@mui/material";
import {
  Visibility as VisibilityIcon,
  VisibilityOff as VisibilityOffIcon,
} from "@mui/icons-material";

import AnnotationIcon from "Features/annotations/components/AnnotationIcon";

import { NO_TEMPLATE_KEY_PREFIX } from "../services/duplicateScopeService";

const ICON_SIZE = 18;

export default function SectionDuplicateAnnotationTemplates({
  listings,
  templatesByListingId,
  countByTemplateKey,
  disabledTemplateKeys,
  onToggleTemplateKey,
  spriteImage,
}) {
  // helpers - one group per listing, rows = its annotation-bearing template
  // keys (templates + a "no template" pseudo row when needed)

  const groups = listings.map((listing) => {
    const noTemplateKey = NO_TEMPLATE_KEY_PREFIX + listing.id;
    const rows = (templatesByListingId[listing.id] ?? []).map((template) => ({
      key: template.id,
      label: template.label || "Sans nom",
      template,
      count: countByTemplateKey[template.id] ?? 0,
    }));
    if (countByTemplateKey[noTemplateKey] > 0) {
      rows.push({
        key: noTemplateKey,
        label: "Sans modèle",
        template: null,
        count: countByTemplateKey[noTemplateKey],
      });
    }
    return { listing, rows };
  });

  // handlers

  function handleToggleListing(group) {
    const allDisabled = group.rows.every((row) =>
      disabledTemplateKeys.includes(row.key)
    );
    group.rows.forEach((row) => {
      const isDisabled = disabledTemplateKeys.includes(row.key);
      if (allDisabled ? isDisabled : !isDisabled) onToggleTemplateKey(row.key);
    });
  }

  // render

  if (groups.length === 0) return null;

  return (
    <Box>
      <Typography variant="caption" sx={{ fontWeight: "bold" }}>
        Listes
      </Typography>

      <Box
        sx={{
          mt: 0.5,
          borderRadius: "4px",
          border: (theme) => `1px solid ${theme.palette.divider}`,
          overflow: "hidden",
        }}
      >
        {groups.map((group) => {
          const allDisabled = group.rows.every((row) =>
            disabledTemplateKeys.includes(row.key)
          );

          return (
            <Box key={group.listing.id}>
              <Box
                sx={{
                  display: "flex",
                  alignItems: "center",
                  px: 1,
                  py: 0.25,
                }}
              >
                <Typography
                  variant="caption"
                  noWrap
                  sx={{
                    fontWeight: "bold",
                    flex: 1,
                    minWidth: 0,
                    color: allDisabled ? "text.disabled" : "text.primary",
                  }}
                >
                  {group.listing.name}
                </Typography>
                <IconButton
                  size="small"
                  onClick={() => handleToggleListing(group)}
                  sx={{ width: 28, height: 28, flexShrink: 0 }}
                >
                  {allDisabled ? (
                    <VisibilityOffIcon sx={{ fontSize: ICON_SIZE }} />
                  ) : (
                    <VisibilityIcon sx={{ fontSize: ICON_SIZE }} />
                  )}
                </IconButton>
              </Box>

              {group.rows.map((row) => {
                const isDisabled = disabledTemplateKeys.includes(row.key);
                return (
                  <Box
                    key={row.key}
                    sx={{
                      display: "flex",
                      alignItems: "center",
                      pl: 2,
                      pr: 1,
                      py: 0.25,
                      opacity: isDisabled ? 0.4 : 1,
                    }}
                  >
                    <Box
                      sx={{
                        display: "flex",
                        alignItems: "center",
                        gap: 1,
                        flex: 1,
                        minWidth: 0,
                      }}
                    >
                      {row.template && (
                        <AnnotationIcon
                          annotation={row.template}
                          spriteImage={spriteImage}
                          size={16}
                        />
                      )}
                      <Typography
                        variant="caption"
                        noWrap
                        sx={{ fontStyle: row.template ? "normal" : "italic" }}
                      >
                        {row.label}
                      </Typography>
                    </Box>
                    <Typography
                      variant="caption"
                      color="text.secondary"
                      sx={{ mx: 0.5, flexShrink: 0 }}
                    >
                      {row.count}
                    </Typography>
                    <IconButton
                      size="small"
                      onClick={() => onToggleTemplateKey(row.key)}
                      sx={{ width: 28, height: 28, flexShrink: 0 }}
                    >
                      {isDisabled ? (
                        <VisibilityOffIcon sx={{ fontSize: ICON_SIZE }} />
                      ) : (
                        <VisibilityIcon sx={{ fontSize: ICON_SIZE }} />
                      )}
                    </IconButton>
                  </Box>
                );
              })}
            </Box>
          );
        })}
      </Box>
    </Box>
  );
}
