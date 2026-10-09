import { useMemo } from "react";

import useResolvedPresetListings from "../hooks/useResolvedPresetListings";
import useFavoriteListings from "../hooks/useFavoriteListings";
import useAnnotationSpriteImage from "Features/annotations/hooks/useAnnotationSpriteImage";

import { Box, Typography } from "@mui/material";

import BoxFlexVStretch from "Features/layout/components/BoxFlexVStretch";
import ButtonInPanelV2 from "Features/layout/components/ButtonInPanelV2";
import AnnotationTemplateIcon from "Features/annotations/components/AnnotationTemplateIcon";
import FieldsListingNameAvatar from "./FieldsListingNameAvatar";

// ---------------------------------------------------------------------------
// SectionPresetListingsPreview — right side of the "pre-configured lists"
// section: one block per selected listing (name + avatar row above the card
// of its annotation templates) and the "Ajouter les N listes" button.
// `overridesByKey` ({ [key]: { name, avatarString } }) holds the user edits;
// `editable={false}` (deferred mode) shows the listing name as a title.
// ---------------------------------------------------------------------------

export default function SectionPresetListingsPreview({
  selectedKeys,
  onAddListings,
  overridesByKey,
  onOverridesChange,
  editable = true,
}) {
  // strings

  const count = selectedKeys?.length ?? 0;
  const addListingsS = `Ajouter les ${count} listes`;
  const emptyS = "Sélectionnez une ou plusieurs listes";

  // data

  const presetListings = useResolvedPresetListings();
  const { favoriteListings } = useFavoriteListings();
  const spriteImage = useAnnotationSpriteImage();

  // helpers

  const favoriteItems = useMemo(() => {
    return favoriteListings.map((fav) => ({
      key: `fav_${fav.sourceListingId}`,
      name: fav.name,
      fullName: fav.name,
      avatarString: fav.avatarString,
      annotationTemplatesLibrary: fav.annotationTemplates,
    }));
  }, [favoriteListings]);

  const selectedListings = useMemo(() => {
    return (
      selectedKeys
        ?.map((key) => {
          if (key.startsWith("fav_")) {
            return favoriteItems.find((f) => f.key === key);
          }
          return presetListings?.find((l) => l.key === key);
        })
        .filter(Boolean) ?? []
    );
  }, [selectedKeys, presetListings, favoriteItems]);

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

  // render

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
                    sx={{ mb: 1 }}
                  />
                ) : (
                  <Typography
                    variant="subtitle1"
                    sx={{ fontWeight: "bold", mb: 0.5 }}
                  >
                    {listing.fullName ?? listing.name}
                  </Typography>
                )}
                <Box
                  sx={{
                    p: 1,
                    bgcolor: "white",
                    borderRadius: 1,
                    border: (theme) => `1px solid ${theme.palette.divider}`,
                  }}
                >
                  {listing.annotationTemplatesLibrary?.map((template, i) => (
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
                        template={template}
                        size={20}
                        spriteImage={spriteImage}
                      />
                      <Typography variant="body2" sx={{ ml: 1 }}>
                        {template.label}
                      </Typography>
                    </Box>
                  ))}
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
