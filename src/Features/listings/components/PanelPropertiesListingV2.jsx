import { useState, useEffect, useRef } from "react";
import { useSelector, useDispatch } from "react-redux";
import { useLiveQuery } from "dexie-react-hooks";

import useUpdateListing from "../hooks/useUpdateListing";
import useAnnotationTemplates from "Features/annotations/hooks/useAnnotationTemplates";
import useUpdateAnnotationTemplate from "Features/annotations/hooks/useUpdateAnnotationTemplate";
import useAnnotationSpriteImage from "Features/annotations/hooks/useAnnotationSpriteImage";

import { setSelectedMainBaseMapId } from "Features/mapEditor/mapEditorSlice";

import {
  Box,
  Typography,
  InputBase,
  IconButton,
  List,
  ListItemButton,
  ListItemText,
} from "@mui/material";
import ChevronRight from "@mui/icons-material/ChevronRight";
import Favorite from "@mui/icons-material/Favorite";
import FavoriteBorder from "@mui/icons-material/FavoriteBorder";

import db from "App/db/db";
import BoxFlexVStretch from "Features/layout/components/BoxFlexVStretch";
import WhiteSectionGeneric from "Features/form/components/WhiteSectionGeneric";
import AnnotationTemplateIcon from "Features/annotations/components/AnnotationTemplateIcon";
import IconButtonMoreActionsListing from "./IconButtonMoreActionsListing";
import useFavoriteListings from "../hooks/useFavoriteListings";

export default function PanelPropertiesListingV2({ listing }) {
  const dispatch = useDispatch();

  // data

  const updateListing = useUpdateListing();
  const { isFavorite, toggleFavorite } = useFavoriteListings();
  const projectId = useSelector((s) => s.projects.selectedProjectId);
  const annotationTemplates = useAnnotationTemplates({
    filterByListingId: listing?.id,
    sortByOrder: true,
  });
  const updateAnnotationTemplate = useUpdateAnnotationTemplate();
  const spriteImage = useAnnotationSpriteImage();
  const selectedBaseMapId = useSelector(
    (s) => s.mapEditor.selectedBaseMapId
  );
  const annotationsUpdatedAt = useSelector(
    (s) => s.annotations.annotationsUpdatedAt
  );

  // state

  const [name, setName] = useState(listing?.name ?? "");
  const [heights, setHeights] = useState({});
  const heightTimers = useRef({});

  useEffect(() => {
    setName(listing?.name ?? "");
  }, [listing?.id, listing?.name]);

  const templatesKey = annotationTemplates
    ?.map((t) => t.id + ":" + (t.height ?? ""))
    .join(",");
  useEffect(() => {
    if (!annotationTemplates) return;
    setHeights((prev) => {
      const next = {};
      annotationTemplates.forEach((t) => {
        next[t.id] = prev[t.id] ?? t.height ?? "";
      });
      return next;
    });
  }, [templatesKey]);

  // data - base maps with annotation counts for this listing

  const baseMapRows = useLiveQuery(
    async () => {
      if (!listing?.id || !projectId) return [];
      const baseMaps = (
        await db.baseMaps.where("projectId").equals(projectId).toArray()
      ).filter((bm) => !bm.deletedAt);

      const annotations = (
        await db.annotations
          .where("listingId")
          .equals(listing.id)
          .toArray()
      ).filter((a) => !a.deletedAt && !a.isBaseMapAnnotation);

      const countByBaseMapId = {};
      annotations.forEach((a) => {
        if (a.baseMapId) {
          countByBaseMapId[a.baseMapId] =
            (countByBaseMapId[a.baseMapId] || 0) + 1;
        }
      });

      return baseMaps
        .map((bm) => ({
          id: bm.id,
          name: bm.name || "Sans nom",
          count: countByBaseMapId[bm.id] || 0,
        }))
        .sort((a, b) => a.name.localeCompare(b.name));
    },
    [listing?.id, projectId, annotationsUpdatedAt]
  );

  // helpers

  const label = listing?.name ?? "Liste";

  // handlers

  const handleNameBlur = async () => {
    if (!listing?.id || name === listing.name) return;
    await updateListing({ id: listing.id, name });
  };

  const handleNameKeyDown = (e) => {
    if (e.key === "Enter") {
      e.target.blur();
    }
  };

  const handleSelectBaseMap = (baseMapId) => {
    dispatch(setSelectedMainBaseMapId(baseMapId));
  };

  const handleHeightChange = (template, value) => {
    setHeights((prev) => ({ ...prev, [template.id]: value }));
    if (heightTimers.current[template.id]) {
      clearTimeout(heightTimers.current[template.id]);
    }
    heightTimers.current[template.id] = setTimeout(() => {
      let valStr = String(value).replace(",", ".");
      let finalValue;
      if (valStr.endsWith(".")) {
        finalValue = valStr;
      } else {
        const numberVal = parseFloat(valStr);
        finalValue = !isNaN(numberVal) ? numberVal : valStr;
      }
      updateAnnotationTemplate({
        id: template.id,
        height: finalValue,
        listingId: listing.id,
        projectId,
      });
    }, 400);
  };

  const handleToggleFavorite = async () => {
    if (!listing?.id) return;
    const templates = (
      await db.annotationTemplates
        .where("listingId")
        .equals(listing.id)
        .toArray()
    ).filter((t) => !t.deletedAt);
    toggleFavorite({ listing, annotationTemplates: templates });
  };

  // render

  return (
    <BoxFlexVStretch sx={{ height: "100%" }}>
      {/* Header */}
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          p: 0.5,
          pl: 2,
        }}
      >
        <Box>
          <Typography
            variant="subtitle2"
            color="text.secondary"
            sx={{
              fontStyle: "italic",
              fontSize: (theme) => theme.typography.caption.fontSize,
            }}
          >
            Liste
          </Typography>
          <Typography variant="body2" sx={{ fontWeight: "bold" }}>
            {label}
          </Typography>
        </Box>
        <IconButtonMoreActionsListing listing={listing} />
      </Box>

      {/* Content */}
      <BoxFlexVStretch sx={{ overflow: "auto", gap: 1, p: 1 }}>
        {/* Name field */}
        <WhiteSectionGeneric>
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ fontWeight: 600, mb: 0.5, display: "block" }}
          >
            Nom
          </Typography>
          <InputBase
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={handleNameBlur}
            onKeyDown={handleNameKeyDown}
            fullWidth
            sx={{
              fontSize: "0.875rem",
              px: 1,
              py: 0.5,
              borderRadius: 1,
              border: (theme) => `1px solid ${theme.palette.divider}`,
              "&:focus-within": {
                borderColor: "primary.main",
              },
            }}
          />
        </WhiteSectionGeneric>

        {/* Favorite toggle */}
        <WhiteSectionGeneric>
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ fontWeight: 600 }}
            >
              Favori
            </Typography>
            <IconButton size="small" onClick={handleToggleFavorite}>
              {isFavorite(listing?.id) ? (
                <Favorite sx={{ color: "orange", fontSize: 20 }} />
              ) : (
                <FavoriteBorder sx={{ color: "text.disabled", fontSize: 20 }} />
              )}
            </IconButton>
          </Box>
        </WhiteSectionGeneric>

        {/* Annotation template heights */}
        {annotationTemplates?.length > 0 && (
          <WhiteSectionGeneric>
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ fontWeight: 600, mb: 0.5, display: "block" }}
            >
              Hauteurs
            </Typography>
            <List dense disablePadding>
              {annotationTemplates.map((template) => (
                <Box
                  key={template.id}
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    gap: 0.5,
                    py: 0.25,
                    px: 1,
                  }}
                >
                  <AnnotationTemplateIcon
                    template={template}
                    spriteImage={spriteImage}
                    size={20}
                  />
                  <Typography
                    variant="body2"
                    noWrap
                    sx={{ flex: 1, minWidth: 0 }}
                  >
                    {template.label}
                  </Typography>
                  <InputBase
                    value={heights[template.id] ?? ""}
                    onChange={(e) =>
                      handleHeightChange(template, e.target.value)
                    }
                    onKeyDown={(e) => {
                      if (
                        e.key === "Backspace" ||
                        e.key === "Delete"
                      )
                        e.stopPropagation();
                    }}
                    sx={{
                      width: 42,
                      fontSize: "0.875rem",
                      px: 0.5,
                      py: 0,
                      borderRadius: 0.5,
                      border: (theme) =>
                        `1px solid ${theme.palette.divider}`,
                      "&:focus-within": {
                        borderColor: "primary.main",
                      },
                      "& .MuiInputBase-input": {
                        textAlign: "right",
                        py: 0.25,
                        px: 0.5,
                      },
                    }}
                  />
                  <Typography
                    variant="body2"
                    color="text.secondary"
                    sx={{ flexShrink: 0 }}
                  >
                    m
                  </Typography>
                </Box>
              ))}
            </List>
          </WhiteSectionGeneric>
        )}

        {/* Annotations per base map */}
        <WhiteSectionGeneric>
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ fontWeight: 600, mb: 0.5, display: "block" }}
          >
            Annotations par fond de plan
          </Typography>
          <List dense disablePadding>
            {baseMapRows?.map((row) => {
              const isSelected = row.id === selectedBaseMapId;
              return (
                <ListItemButton
                  key={row.id}
                  onClick={() => handleSelectBaseMap(row.id)}
                  sx={{
                    borderRadius: 1,
                    py: 0.5,
                    px: 1,
                    bgcolor: isSelected ? "action.selected" : "transparent",
                    "&:hover": { bgcolor: "action.hover" },
                  }}
                >
                  <ListItemText
                    primary={row.name}
                    primaryTypographyProps={{
                      variant: "body2",
                      fontWeight: isSelected ? 600 : 400,
                      noWrap: true,
                    }}
                  />
                  <Typography
                    variant="body2"
                    sx={{
                      fontFamily: "monospace",
                      fontSize: "10px",
                      fontWeight: 500,
                      color: row.count > 0 ? "secondary.main" : "text.disabled",
                      mr: 0.5,
                      minWidth: 20,
                      textAlign: "right",
                    }}
                  >
                    {row.count}
                  </Typography>
                  <ChevronRight
                    sx={{ fontSize: 16, color: "text.disabled" }}
                  />
                </ListItemButton>
              );
            })}
            {baseMapRows?.length === 0 && (
              <Typography
                variant="body2"
                color="text.disabled"
                sx={{ py: 1, textAlign: "center" }}
              >
                Aucun fond de plan
              </Typography>
            )}
          </List>
        </WhiteSectionGeneric>
      </BoxFlexVStretch>
    </BoxFlexVStretch>
  );
}
