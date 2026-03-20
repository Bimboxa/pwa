import { useState, useEffect } from "react";
import { useSelector, useDispatch } from "react-redux";
import { useLiveQuery } from "dexie-react-hooks";

import useUpdateListing from "../hooks/useUpdateListing";

import { setSelectedMainBaseMapId } from "Features/mapEditor/mapEditorSlice";

import {
  Box,
  Typography,
  InputBase,
  List,
  ListItemButton,
  ListItemText,
} from "@mui/material";
import ChevronRight from "@mui/icons-material/ChevronRight";

import db from "App/db/db";
import BoxFlexVStretch from "Features/layout/components/BoxFlexVStretch";
import WhiteSectionGeneric from "Features/form/components/WhiteSectionGeneric";
import IconButtonMoreActionsListing from "./IconButtonMoreActionsListing";

export default function PanelPropertiesListingV2({ listing }) {
  const dispatch = useDispatch();

  // data

  const updateListing = useUpdateListing();
  const projectId = useSelector((s) => s.projects.selectedProjectId);
  const selectedBaseMapId = useSelector(
    (s) => s.mapEditor.selectedBaseMapId
  );
  const annotationsUpdatedAt = useSelector(
    (s) => s.annotations.annotationsUpdatedAt
  );

  // state

  const [name, setName] = useState(listing?.name ?? "");

  useEffect(() => {
    setName(listing?.name ?? "");
  }, [listing?.id, listing?.name]);

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
