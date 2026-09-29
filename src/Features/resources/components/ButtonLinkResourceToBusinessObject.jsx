import { useDispatch, useSelector } from "react-redux";
import { useLiveQuery } from "dexie-react-hooks";

import { triggerRelsBusinessObjectResourceUpdate } from "Features/businessObjects/businessObjectsSlice";
import { setToaster } from "Features/layout/layoutSlice";

import { Box, Button, Typography } from "@mui/material";
import { AddLink, LinkOff } from "@mui/icons-material";

import db from "App/db/db";

import useRelsBusinessObjectResource from "Features/businessObjects/hooks/useRelsBusinessObjectResource";
import linkResourceToBusinessObjectService from "Features/businessObjects/services/linkResourceToBusinessObjectService";
import getBusinessObjectTypeOfListing from "Features/businessObjects/utils/getBusinessObjectTypeOfListing";
import isWholeResourceRel from "Features/businessObjects/utils/isWholeResourceRel";
import selectSelectedBusinessObjectId from "Features/businessObjects/utils/selectSelectedBusinessObjectId";

// Row of the resource detail panel linking the WHOLE resource (any file
// type) to the target business object — the selected one, else the module's
// active one, like the highlights of the document viewer. Toggles to
// "Délier" once linked. Disabled without target.
export default function ButtonLinkResourceToBusinessObject({ resource }) {
  const dispatch = useDispatch();

  // strings

  const noTargetS = "Sélectionnez un objet pour lui lier cette ressource";
  const unlinkS = "Délier";

  // data

  const selectedBusinessObjectId = useSelector(selectSelectedBusinessObjectId);
  const activeBusinessObjectId = useSelector(
    (s) => s.businessObjects.activeBusinessObjectId
  );
  const businessObjectsUpdatedAt = useSelector(
    (s) => s.businessObjects.businessObjectsUpdatedAt
  );
  const businessObjectId = selectedBusinessObjectId ?? activeBusinessObjectId;

  const target = useLiveQuery(async () => {
    if (!businessObjectId) return null;
    const businessObject = await db.businessObjects.get(businessObjectId);
    if (!businessObject || businessObject.deletedAt) return null;
    const listing = await db.listings.get(businessObject.listingId);
    return { businessObject, listing };
  }, [businessObjectId, businessObjectsUpdatedAt]);

  const { value: rels } = useRelsBusinessObjectResource({
    businessObjectId: target?.businessObject?.id,
  });

  // helpers

  const businessObject = target?.businessObject ?? null;
  const type = getBusinessObjectTypeOfListing(target?.listing);
  const rel =
    (rels ?? []).find(
      (r) => isWholeResourceRel(r) && r.resourceId === resource.id
    ) ?? null;
  const labelS = rel ? unlinkS : type.strings.linkResourceTo;
  const Icon = rel ? LinkOff : AddLink;

  // handlers

  async function handleClick() {
    if (!businessObject) return;
    try {
      if (rel) {
        await db.relsBusinessObjectResource.delete(rel.id);
      } else {
        await linkResourceToBusinessObjectService({ businessObject, resource });
      }
      dispatch(triggerRelsBusinessObjectResourceUpdate());
    } catch (error) {
      console.error("[ButtonLinkResourceToBusinessObject]", error);
      dispatch(
        setToaster({ message: error?.message ?? `${error}`, isError: true })
      );
    }
  }

  // render

  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 1,
        px: 1,
        py: 0.5,
        borderBottom: (theme) => `1px solid ${theme.palette.divider}`,
        flexShrink: 0,
      }}
    >
      <Typography variant="caption" color="text.secondary" noWrap>
        {businessObject
          ? `${type.strings.objectLabel} : ${businessObject.label}`
          : noTargetS}
      </Typography>
      <Button
        size="small"
        variant={rel ? "text" : "outlined"}
        disabled={!businessObject}
        onClick={handleClick}
        startIcon={<Icon fontSize="small" />}
        sx={{ flexShrink: 0, textTransform: "none" }}
      >
        {labelS}
      </Button>
    </Box>
  );
}
