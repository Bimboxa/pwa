import useSelectedListing from "Features/listings/hooks/useSelectedListing";

import { Box } from "@mui/material";

import BlockEntityInPanel from "Features/entities/components/BlockEntityInPanel";
import BlockBottomActionsInPanel from "Features/entityProps/components/BlockBottomActionsInPanel";

export default function ListPanelBottom() {
  // data

  const { value: listing } = useSelectedListing({ withEntityModel: true });
  const entityModel = listing?.entityModel;

  // helper

  const show = listing?.canCreateItem;

  // helpers

  const componentByEntityModel = {
    ENTITY_PROPS: <BlockBottomActionsInPanel />,
    KEY_VALUE: <Box />,
  };

  // const component = componentByEntityModel[entityModel?.type] ?? (
  //   <BlockEntityInPanel />
  // );
  const component = componentByEntityModel[entityModel?.type] ?? null;

  return (
    <Box sx={{ width: 1, display: show ? "flex" : "none" }}>{component}</Box>
  );
}
