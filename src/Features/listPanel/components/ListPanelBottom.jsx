import useSelectedListing from "Features/listings/hooks/useSelectedListing";
import useListingEntityModel from "Features/entities/hooks/useListingEntityModel";

import {Box} from "@mui/material";

import ButtonCreateListingItem from "Features/listings/components/ButtonCreateListingItem";
import BlockBottomActionsInPanel from "Features/entityProps/components/BlockBottomActionsInPanel";

export default function ListPanelBottom() {
  // data

  const {value: listing} = useSelectedListing();
  const entityModel = useListingEntityModel(listing);

  // helpers

  const componentByEntityModel = {
    ENTITY_PROPS: <BlockBottomActionsInPanel />,
  };

  const component = componentByEntityModel[entityModel?.type] ?? (
    <ButtonCreateListingItem listing={listing} />
  );

  return <Box sx={{width: 1, p: 1, bgcolor: "green"}}>{component}</Box>;
}
