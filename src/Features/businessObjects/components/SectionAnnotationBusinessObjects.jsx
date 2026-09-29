import { useDispatch, useSelector } from "react-redux";
import { useLiveQuery } from "dexie-react-hooks";

import { triggerRelsBusinessObjectAnnotationUpdate } from "../businessObjectsSlice";

import { Box, Chip, Typography } from "@mui/material";
import { Place } from "@mui/icons-material";

import db from "App/db/db";

import useRelsBusinessObjectAnnotation from "../hooks/useRelsBusinessObjectAnnotation";
import useOpenBusinessObject from "../hooks/useOpenBusinessObject";

import getBusinessObjectTypeOfListing from "../utils/getBusinessObjectTypeOfListing";
import { isBusinessObjectClosed } from "../utils/getBusinessObjectStatus";

// Business objects linked to one annotation (db.relsBusinessObjectAnnotation),
// in the annotation properties: one group of chips per business object type,
// titled with the type's wording ("Ouvrages liés", "Points liés"...). A chip
// click opens the object in its module; its delete icon removes the link.
// Closed objects (types with a status) are struck through, main links
// ("Localisation") carry a pin. Renders nothing without link.
export default function SectionAnnotationBusinessObjects({ annotation }) {
  const dispatch = useDispatch();

  // data

  const businessObjectsUpdatedAt = useSelector(
    (s) => s.businessObjects.businessObjectsUpdatedAt
  );
  const { value: rels } = useRelsBusinessObjectAnnotation({
    annotationId: annotation?.id,
  });
  const openBusinessObject = useOpenBusinessObject();

  const relIdsKey = (rels ?? []).map((r) => r.id).join(",");
  const groups = useLiveQuery(async () => {
    if (!rels?.length) return [];
    const businessObjects = (
      await db.businessObjects.bulkGet(rels.map((r) => r.businessObjectId))
    ).filter((o) => o && !o.deletedAt);
    const listingIds = [...new Set(businessObjects.map((o) => o.listingId))];
    const listingById = {};
    (await db.listings.bulkGet(listingIds)).forEach((l) => {
      if (l) listingById[l.id] = l;
    });
    const relByObjectId = {};
    rels.forEach((r) => {
      relByObjectId[r.businessObjectId] = r;
    });

    const groupByTypeKey = {};
    businessObjects.forEach((businessObject) => {
      const type = getBusinessObjectTypeOfListing(
        listingById[businessObject.listingId]
      );
      (groupByTypeKey[type.key] ??= { type, rows: [] }).rows.push({
        businessObject,
        rel: relByObjectId[businessObject.id],
      });
    });
    return Object.values(groupByTypeKey);
  }, [relIdsKey, businessObjectsUpdatedAt]);

  // handlers

  async function handleUnlink(rel) {
    await db.relsBusinessObjectAnnotation.delete(rel.id);
    dispatch(triggerRelsBusinessObjectAnnotationUpdate());
  }

  // render

  if (!annotation || !groups?.length) return null;

  return (
    <>
      {groups.map(({ type, rows }) => (
        <Box key={type.key} sx={{ p: 1 }}>
          <Typography variant="caption" color="text.secondary">
            {type.strings.linkedObjects}
          </Typography>
          <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5, mt: 0.5 }}>
            {rows.map(({ businessObject, rel }) => (
              <Chip
                key={rel.id}
                size="small"
                label={businessObject.label}
                icon={rel.isMain ? <Place sx={{ fontSize: 14 }} /> : undefined}
                onClick={() => openBusinessObject(businessObject)}
                onDelete={() => handleUnlink(rel)}
                sx={
                  isBusinessObjectClosed(businessObject)
                    ? {
                        textDecoration: "line-through",
                        color: "text.disabled",
                      }
                    : undefined
                }
              />
            ))}
          </Box>
        </Box>
      ))}
    </>
  );
}
