import {useState, useEffect} from "react";

import {useSelector} from "react-redux";

import useSelectedListing from "Features/listings/hooks/useSelectedListing";
import useEntitiesWithProps from "../hooks/useEntitiesWithProps";
import useCreateOrUpdateEntityProps from "../hooks/useCreateOrUpdateEntityProps";

import {Box, Typography} from "@mui/material";
import BlockButtonsCancelSave from "Features/layout/components/BlockButtonsCancelSave";
import BlockEntityPropsActions from "./BlockEntityPropsActions";

export default function SectionActionsEntityPropsVariantMulti() {
  // state

  const [tempPropsObject, setTempPropsObject] = useState(null);

  // data

  const {value: listing} = useSelectedListing({withEntityModel: true});
  const selection = useSelector((s) => s.entityProps.selection);
  const {value: entitiesWithProps} = useEntitiesWithProps();

  // data - func

  const createOrUpdate = useCreateOrUpdateEntityProps();

  // helpers

  const selectedEntitiesWithProps = entitiesWithProps?.filter((entity) =>
    selection.includes(entity.id)
  );

  // handlers

  function handleChange(newPropsObject) {
    setTempPropsObject(newPropsObject);
  }

  function handleCancel() {
    setTempPropsObject(null);
  }

  async function handleSave() {
    const listingKey = listing?.key;
    await Promise.all(
      selectedEntitiesWithProps.map(async (entity) => {
        const targetEntityId = entity?.id;
        const targetListingKey = entity?.listingKey;
        await createOrUpdate({
          listingKey,
          targetEntityId,
          targetListingKey,
          props: tempPropsObject?.props,
        });
      })
    );
    setTempPropsObject(null);
  }

  return (
    <Box
      sx={{
        width: 1,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
      }}
    >
      <BlockButtonsCancelSave onCancel={handleCancel} onSave={handleSave} />
      <BlockEntityPropsActions
        listing={listing}
        props={tempPropsObject?.props}
        onChange={handleChange}
      />
    </Box>
  );
}
