import useSelectedListing from "Features/listings/hooks/useSelectedListing";
import useListingEntityModel from "Features/listings/hooks/useListingEntityModel";

import {Box} from "@mui/material";

import BlockEntityInListPanel from "Features/entities/components/BlockEntityInListPanel";
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
    <BlockEntityInListPanel />
  );

  return <Box sx={{width: 1}}>{component}</Box>;
}
