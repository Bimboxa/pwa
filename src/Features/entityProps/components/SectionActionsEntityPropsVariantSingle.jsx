import useSelectedEntityWithProps from "../hooks/useSelectedEntityWithProps";
import useSelectedListing from "Features/listings/hooks/useSelectedListing";

import {Typography} from "@mui/material";

import BlockEntityPropsActions from "./BlockEntityPropsActions";

export default function SectionActionsEntityPropsVariantSingle() {
  // data

  const {value: listing} = useSelectedListing({withEntityModel: true});
  const entityWithProps = useSelectedEntityWithProps();

  // helpers

  const props = entityWithProps?.props;

  // handlers

  function handleChange(newProps) {
    console.log(newProps);
  }

  return (
    <div>
      <Typography>{entityWithProps?.label}</Typography>
      <BlockEntityPropsActions
        listing={listing}
        props={props}
        onChange={handleChange}
      />
    </div>
  );
}
