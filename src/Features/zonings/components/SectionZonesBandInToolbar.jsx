import { useMemo, useState } from "react";
import { useDispatch, useSelector } from "react-redux";

import { triggerRelsZoneAnnotationUpdate } from "../zoningsSlice";

import {
  Box,
  Chip,
  ListSubheader,
  Menu,
  MenuItem,
  Typography,
} from "@mui/material";
import { Add } from "@mui/icons-material";

import db from "App/db/db";

import useZoningListings from "../hooks/useZoningListings";
import useZones from "../hooks/useZones";
import useRelsZoneAnnotation from "../hooks/useRelsZoneAnnotation";
import addZoneToAnnotationService from "../services/addZoneToAnnotationService";
import buildZonesTree from "../utils/buildZonesTree";

// Band shown under the actions row of ToolbarEditAnnotation(s) when the ZONES
// module is active: lists the zones linked to the selection (chips) and lets
// the user link/unlink zones for every selected annotation at once.
export default function SectionZonesBandInToolbar({ annotations }) {
  const dispatch = useDispatch();

  // data

  const isZonesModule = useSelector(
    (s) => s.viewers.selectedViewerKey === "ZONES"
  );
  const scopeId = useSelector((s) => s.scopes.selectedScopeId);
  const zoningListings = useZoningListings();
  const { value: scopeZones } = useZones({ scopeId });

  // helpers — target annotations (zone delimitation polygons excluded)

  const targets = useMemo(
    () => (annotations ?? []).filter((a) => a && !a.isZoneAnnotation),
    [annotations]
  );
  const targetIds = useMemo(() => targets.map((a) => a.id), [targets]);

  const { value: rels } = useRelsZoneAnnotation({
    annotationIds: targetIds,
  });

  // state

  const [menuAnchor, setMenuAnchor] = useState(null);

  // helpers

  const zoneById = useMemo(() => {
    const map = {};
    (scopeZones ?? []).forEach((z) => {
      map[z.id] = z;
    });
    return map;
  }, [scopeZones]);

  // linked zones with the count of selected annotations linked to each
  const linkedZones = useMemo(() => {
    const byZoneId = {};
    (rels ?? []).forEach((rel) => {
      const zone = zoneById[rel.zoneId];
      if (!zone) return;
      if (!byZoneId[zone.id]) byZoneId[zone.id] = { zone, relIds: [], count: 0 };
      byZoneId[zone.id].relIds.push(rel.id);
      byZoneId[zone.id].count++;
    });
    return Object.values(byZoneId);
  }, [rels, zoneById]);

  const treesByListing = useMemo(() => {
    return (zoningListings ?? []).map((listing) => ({
      listing,
      flatTree: buildZonesTree(
        (scopeZones ?? []).filter((z) => z.listingId === listing.id)
      ),
    }));
  }, [zoningListings, scopeZones]);

  // handlers

  async function handleAddZone(zone) {
    setMenuAnchor(null);
    for (const annotation of targets) {
      await addZoneToAnnotationService({ annotation, zone });
    }
    dispatch(triggerRelsZoneAnnotationUpdate());
  }

  async function handleRemoveZone(entry) {
    // soft-delete middleware sets deletedAt
    await db.relsZoneAnnotation.bulkDelete(entry.relIds);
    dispatch(triggerRelsZoneAnnotationUpdate());
  }

  // render

  if (!isZonesModule) return null;
  if (targets.length === 0) return null;
  if ((zoningListings?.length ?? 0) === 0) return null;

  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        flexWrap: "wrap",
        gap: 0.5,
        px: 1.25,
        py: 0.75,
        borderTop: "1px solid",
        borderColor: "divider",
      }}
    >
      <Typography variant="body2" color="text.secondary" sx={{ mr: 0.5 }}>
        Zones
      </Typography>

      {linkedZones.map(({ zone, relIds, count }) => (
        <Chip
          key={zone.id}
          size="small"
          label={
            targets.length > 1 && count < targets.length
              ? `${zone.label} (${count}/${targets.length})`
              : zone.label
          }
          icon={
            <Box
              sx={{
                width: 10,
                height: 10,
                borderRadius: "50%",
                bgcolor: zone.color,
                ml: 0.5,
              }}
            />
          }
          onDelete={() => handleRemoveZone({ relIds })}
        />
      ))}

      <Chip
        size="small"
        variant="outlined"
        icon={<Add sx={{ fontSize: 14 }} />}
        label="Zone"
        onClick={(e) => setMenuAnchor(e.currentTarget)}
      />

      <Menu
        open={Boolean(menuAnchor)}
        anchorEl={menuAnchor}
        onClose={() => setMenuAnchor(null)}
      >
        {treesByListing.flatMap(({ listing, flatTree }) => [
          <ListSubheader key={listing.id} sx={{ lineHeight: "32px" }}>
            {listing.name}
          </ListSubheader>,
          ...flatTree.map(({ zone, depth }) => (
            <MenuItem
              key={zone.id}
              onClick={() => handleAddZone(zone)}
              sx={{ pl: 2 + depth * 2 }}
            >
              <Box
                sx={{
                  width: 10,
                  height: 10,
                  borderRadius: "50%",
                  bgcolor: zone.color,
                  mr: 1,
                }}
              />
              {zone.label}
            </MenuItem>
          )),
        ])}
      </Menu>
    </Box>
  );
}
