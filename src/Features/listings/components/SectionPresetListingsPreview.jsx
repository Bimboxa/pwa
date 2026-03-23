import { useMemo } from "react";

import useResolvedPresetListings from "../hooks/useResolvedPresetListings";
import useFavoriteListings from "../hooks/useFavoriteListings";
import useAnnotationSpriteImage from "Features/annotations/hooks/useAnnotationSpriteImage";

import { Box, Typography } from "@mui/material";

import BoxFlexVStretch from "Features/layout/components/BoxFlexVStretch";
import ButtonInPanelV2 from "Features/layout/components/ButtonInPanelV2";
import AnnotationTemplateIcon from "Features/annotations/components/AnnotationTemplateIcon";

export default function SectionPresetListingsPreview({
  selectedKeys,
  onAddListings,
}) {
  // strings

  const count = selectedKeys?.length ?? 0;
  const addListingsS = `Ajouter les ${count} listes`;

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

  // render

  return (
    <BoxFlexVStretch sx={{ width: 1, p: 1 }}>
      <BoxFlexVStretch
        sx={{
          overflow: "auto",
          p: 1,
          bgcolor: "white",
          borderRadius: 1,
          border: (theme) => `1px solid ${theme.palette.divider}`,
        }}
      >
        {selectedListings.length === 0 ? (
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flex: 1,
              py: 4,
            }}
          >
            <Typography variant="body2" color="text.secondary">
              Sélectionnez une ou plusieurs listes
            </Typography>
          </Box>
        ) : (
          selectedListings.map((listing) => (
            <Box key={listing.key} sx={{ mb: 2, width: 1 }}>
              <Typography
                variant="subtitle1"
                sx={{ fontWeight: "bold", mb: 0.5 }}
              >
                {listing.fullName ?? listing.name}
              </Typography>
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
                  <AnnotationTemplateIcon template={template} size={20} spriteImage={spriteImage} />
                  <Typography variant="body2" sx={{ ml: 1 }}>
                    {template.label}
                  </Typography>
                </Box>
              ))}
            </Box>
          ))
        )}
      </BoxFlexVStretch>

      <Box>
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
