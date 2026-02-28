import { useState } from "react";

import { useSelector } from "react-redux";
import { useLiveQuery } from "dexie-react-hooks";

import db from "App/db/db";
import useAppConfig from "Features/appConfig/hooks/useAppConfig";
import useUpdateListing from "Features/listings/hooks/useUpdateListing";
import useDeleteListing from "Features/listings/hooks/useDeleteListing";
import useListingFormTemplate from "Features/listings/hooks/useListingFormTemplate";

import BoxFlexVStretch from "Features/layout/components/BoxFlexVStretch";
import ButtonInPanelV2 from "Features/layout/components/ButtonInPanelV2";
import FormGenericV2 from "Features/form/components/FormGenericV2";

export default function PanelAdminListing() {
  // data

  const selectedListingId = useSelector(
    (s) => s.adminEditor.selectedListingId
  );
  const appConfig = useAppConfig();

  const listing = useLiveQuery(async () => {
    if (!selectedListingId) return null;
    const l = await db.listings.get(selectedListingId);
    if (!l || l.deletedAt) return null;
    if (l.entityModel) return l;
    // fallback for listings created before entityModel was stored
    const entityModel =
      appConfig?.entityModelsObject?.[l?.entityModelKey] ?? null;
    return entityModel ? { ...l, entityModel } : l;
  }, [selectedListingId, appConfig]);

  const update = useUpdateListing();
  const deleteListing = useDeleteListing();

  const template = useListingFormTemplate(listing, { variant: "basic" });

  // state

  const [editedListing, setEditedListing] = useState(null);

  // helpers

  const isEditing = editedListing !== null;
  const currentListing = isEditing ? editedListing : listing;

  // handlers

  function handleChange(updated) {
    setEditedListing(updated);
  }

  async function handleSave() {
    if (!editedListing) return;
    await update(editedListing);
    setEditedListing(null);
  }

  async function handleDelete() {
    if (!listing?.id) return;
    await deleteListing(listing.id);
    setEditedListing(null);
  }

  if (!listing) return null;

  // render

  return (
    <BoxFlexVStretch>
      <FormGenericV2
        template={template}
        item={currentListing}
        onItemChange={handleChange}
      />
      <ButtonInPanelV2
        label="Save"
        onClick={handleSave}
        disabled={!isEditing}
        variant="contained"
      />
      <ButtonInPanelV2
        label="Delete"
        onClick={handleDelete}
        variant="outlined"
        color="error"
      />
    </BoxFlexVStretch>
  );
}
