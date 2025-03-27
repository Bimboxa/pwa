import useSelectedEntityWithProps from "../hooks/useSelectedEntityWithProps";
import useSelectedListing from "Features/listings/hooks/useSelectedListing";
import useCreateOrUpdateEntityProps from "../hooks/useCreateOrUpdateEntityProps";

import {Typography, Box} from "@mui/material";

import BlockEntityPropsActions from "./BlockEntityPropsActions";

export default function SectionActionsEntityPropsVariantSingle() {
  // data

  const {value: listing} = useSelectedListing({withEntityModel: true});
  const entityWithProps = useSelectedEntityWithProps();

  const createOrUpdate = useCreateOrUpdateEntityProps();

  // helpers

  const props = entityWithProps?.props;

  // handlers

  async function handleChange(newPropsObject) {
    const newProps = newPropsObject.props;
    console.log("newProps", newProps);
    const listingKey = listing?.key;
    const targetEntityId = entityWithProps?.id;
    const targetListingKey = entityWithProps?.listingKey;

    await createOrUpdate({
      props: newProps,
      listingKey,
      targetEntityId,
      targetListingKey,
    });
  }

  return (
    <Box
      sx={{
        width: 1,
        p: 1,
        display: "flex",
        justifyContent: "space-between",
        alinItems: "center",
      }}
    >
      <Typography>{entityWithProps?.label}</Typography>
      <BlockEntityPropsActions
        listing={listing}
        props={props}
        onChange={handleChange}
      />
    </Box>
  );
}
