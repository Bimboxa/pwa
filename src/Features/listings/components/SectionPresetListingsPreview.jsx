import { useMemo } from "react";

import useResolvedPresetListings from "../hooks/useResolvedPresetListings";
import useAnnotationSpriteImage from "Features/annotations/hooks/useAnnotationSpriteImage";

import { Box, Divider, IconButton, Tooltip, Typography } from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";

import BoxFlexVStretch from "Features/layout/components/BoxFlexVStretch";
import ButtonInPanelV2 from "Features/layout/components/ButtonInPanelV2";
import AnnotationTemplateIcon from "Features/annotations/components/AnnotationTemplateIcon";
import groupAnnotationTemplatesByGroupLabel from "Features/annotations/utils/groupAnnotationTemplatesByGroupLabel";
import FieldsListingNameAvatar from "./FieldsListingNameAvatar";

// ---------------------------------------------------------------------------
// SectionPresetListingsPreview — right side of the "pre-configured lists"
// section: one block per selected listing (name + avatar row above the card
// of its annotation templates) and the "Ajouter les N listes" button.
// `overridesByKey` ({ [key]: { name, avatarString } }) holds the user edits;
// `editable={false}` (deferred mode) shows the listing name as a title.
// `onSelectedKeysChange` enables the "x" that drops a listing from the
// selection. `listings` (optional) replaces the resolved preset listings as
// the candidates the selected keys are looked up in (favorites dialog).
// ---------------------------------------------------------------------------

export default function SectionPresetListingsPreview({
  selectedKeys,
  onAddListings,
  overridesByKey,
  onOverridesChange,
  onSelectedKeysChange,
  editable = true,
  listings,
}) {
  // strings

  const count = selectedKeys?.length ?? 0;
  const addListingsS = `Ajouter les ${count} listes`;
  const emptyS = "Sélectionnez une ou plusieurs listes";
  const namePlaceholderS = "Nom de la liste";
  const removeS = "Retirer de la sélection";

  // data

  const presetListings = useResolvedPresetListings();
  const spriteImage = useAnnotationSpriteImage();

  // helpers

  const candidates = listings ?? presetListings;

  const selectedListings = useMemo(() => {
    return (
      selectedKeys
        ?.map((key) => candidates?.find((l) => l.key === key))
        .filter(Boolean) ?? []
    );
  }, [selectedKeys, candidates]);

  function getDefaultOverride(listing) {
    return {
      name: listing.name ?? listing.fullName ?? "",
      avatarString: listing.avatarString ?? "",
    };
  }

  // handlers

  function handleOverrideChange(listing, patch) {
    const current =
      overridesByKey?.[listing.key] ?? getDefaultOverride(listing);
    onOverridesChange?.({
      ...overridesByKey,
      [listing.key]: { ...current, ...patch },
    });
  }

  function handleRemove(listing) {
    onSelectedKeysChange?.(selectedKeys.filter((k) => k !== listing.key));
  }

  // render

  // "x" at the end of a listing header — only when the selection is editable
  function renderRemoveButton(listing) {
    if (!onSelectedKeysChange) return null;
    return (
      <Tooltip title={removeS}>
        <IconButton
          size="small"
          onClick={() => handleRemove(listing)}
          sx={{ color: "text.secondary", p: 0.25, flexShrink: 0 }}
        >
          <CloseIcon sx={{ fontSize: 16 }} />
        </IconButton>
      </Tooltip>
    );
  }

  return (
    <BoxFlexVStretch sx={{ width: 1, p: 1 }}>
      <BoxFlexVStretch sx={{ overflow: "auto", gap: 2 }}>
        {selectedListings.length === 0 ? (
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flex: 1,
              py: 4,
              bgcolor: "white",
              borderRadius: 1,
              border: (theme) => `1px solid ${theme.palette.divider}`,
            }}
          >
            <Typography variant="body2" color="text.secondary">
              {emptyS}
            </Typography>
          </Box>
        ) : (
          selectedListings.map((listing) => {
            const override =
              overridesByKey?.[listing.key] ?? getDefaultOverride(listing);
            return (
              <Box key={listing.key} sx={{ width: 1, flexShrink: 0 }}>
                {editable ? (
                  <FieldsListingNameAvatar
                    name={override.name}
                    avatarString={override.avatarString}
                    onNameChange={(name) =>
                      handleOverrideChange(listing, { name })
                    }
                    onAvatarStringChange={(avatarString) =>
                      handleOverrideChange(listing, { avatarString })
                    }
                    namePlaceholder={namePlaceholderS}
                    size={28}
                    sx={{ mb: 0.75 }}
                  >
                    {renderRemoveButton(listing)}
                  </FieldsListingNameAvatar>
                ) : (
                  <Box
                    sx={{
                      display: "flex",
                      alignItems: "center",
                      gap: 1,
                      mb: 0.5,
                    }}
                  >
                    <Typography
                      variant="subtitle1"
                      sx={{ fontWeight: "bold", flexGrow: 1, minWidth: 0 }}
                      noWrap
                    >
                      {listing.fullName ?? listing.name}
                    </Typography>
                    {renderRemoveButton(listing)}
                  </Box>
                )}
                <Box
                  sx={{
                    p: 1,
                    bgcolor: "white",
                    borderRadius: 1,
                    border: (theme) => `1px solid ${theme.palette.divider}`,
                  }}
                >
                  {groupAnnotationTemplatesByGroupLabel(
                    listing.annotationTemplatesLibrary
                  ).map((item, i) => {
                    if (item.isGroupDivider) {
                      return (
                        <Divider key={`divider-${i}`} sx={{ mx: 1, my: 0.5 }} />
                      );
                    }
                    if (item.isGroupHeader) {
                      return (
                        <Typography
                          key={`group-${i}`}
                          variant="caption"
                          sx={{
                            display: "block",
                            pl: 1,
                            pt: i > 0 ? 1 : 0.25,
                            pb: 0.5,
                            color: "text.secondary",
                            textTransform: "uppercase",
                            fontWeight: 600,
                            fontSize: "0.7rem",
                            letterSpacing: 0.5,
                          }}
                        >
                          {item.groupLabel}
                        </Typography>
                      );
                    }
                    return (
                      <Box
                        key={i}
                        sx={{
                          display: "flex",
                          alignItems: "center",
                          mb: 0.5,
                          ml: 1,
                          width: 1,
                        }}
                      >
                        <AnnotationTemplateIcon
                          template={item}
                          size={20}
                          spriteImage={spriteImage}
                        />
                        <Typography variant="body2" sx={{ ml: 1 }}>
                          {item.label}
                        </Typography>
                      </Box>
                    );
                  })}
                </Box>
              </Box>
            );
          })
        )}
      </BoxFlexVStretch>

      <Box sx={{ mt: 2 }}>
        <ButtonInPanelV2
          label={addListingsS}
          onClick={onAddListings}
          variant="contained"
          disabled={!count}
          sx={{
            bgcolor: "common.black",
            color: "white",
            "&:hover": { bgcolor: "grey.800" },
          }}
        />
      </Box>
    </BoxFlexVStretch>
  );
}
