import {useState, useEffect} from "react";

import {useSelector, useDispatch} from "react-redux";

import {setTempPropsObject} from "../entityPropsSlice";

import useSelectedListing from "Features/listings/hooks/useSelectedListing";
import useEntitiesWithProps from "../hooks/useEntitiesWithProps";

import useCreateOrUpdateEntityProps from "../hooks/useCreateOrUpdateEntityProps";
import useDeleteEntityProps from "../hooks/useDeleteEntityProps";

import {Box, Typography} from "@mui/material";
import BlockButtonsCancelSave from "Features/layout/components/BlockButtonsCancelSave";
import BlockEntityPropsActions from "./BlockEntityPropsActions";
import getMergedProps from "../utils/getMergedProps";

export default function SectionActionsEntityPropsVariantMulti() {
  const dispatch = useDispatch();

  const tempPropsObject = useSelector((s) => s.entityProps.tempPropsObject);

  // data

  const {value: listing} = useSelectedListing();
  const selection = useSelector((s) => s.entityProps.selection);
  const {value: entitiesWithProps} = useEntitiesWithProps();

  // data - func

  const createOrUpdate = useCreateOrUpdateEntityProps();
  const deleteEntityProps = useDeleteEntityProps();

  // helpers

  const selectedEntitiesWithProps = entitiesWithProps?.filter((entity) =>
    selection.includes(entity.id)
  );

  const selectionS = `Sélection: x${selection.length}`;

  // effects -update tempPropsObject
  useEffect(() => {
    if (!selectedEntitiesWithProps) return;
    if (selectedEntitiesWithProps.length === 0) {
      dispatch(setTempPropsObject(null));
    } else {
      const props = getMergedProps(selectedEntitiesWithProps);
      dispatch(setTempPropsObject({props}));
    }
  }, [selection]);

  // handlers

  function handleChange(newPropsObject) {
    console.log("newPropsObject", newPropsObject);
    dispatch(setTempPropsObject(newPropsObject));
  }

  function handleCancel() {
    dispatch(setTempPropsObject(null));
  }

  async function handleSave() {
    // edge case: delete
    if (tempPropsObject?.delete) {
      await Promise.all(
        selectedEntitiesWithProps.map(async (entity) => {
          const entityPropsId = entity?.entityPropsId;
          await deleteEntityProps(entityPropsId);
        })
      );
      dispatch(setTempPropsObject(null));
      return;
    }

    // main
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
    dispatch(setTempPropsObject(null));
  }

  return (
    <Box
      sx={{
        width: 1,
        p: 1,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
      }}
    >
      {/* <BlockButtonsCancelSave onCancel={handleCancel} onSave={handleSave} /> */}
      <Typography variant="body2" color="text.secondary">
        {selectionS}
      </Typography>
      <BlockEntityPropsActions
        listing={listing}
        propsObject={tempPropsObject}
        onChange={handleChange}
      />
    </Box>
  );
}
