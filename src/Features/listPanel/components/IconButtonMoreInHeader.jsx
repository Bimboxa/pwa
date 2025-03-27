import useSelectedListing from "Features/listings/hooks/useSelectedListing";
import useListingEntityModel from "Features/listings/hooks/useListingEntityModel";

import {Box} from "@mui/material";

//import IconButtonMenuMoreShapes from "Features/shapes/components/IconButtonMenuMoreShapes";
import IconButtonMoreZones from "Features/zones/components/IconButtonMoreZones";
import IconButtonMoreListing from "Features/listings/components/IconButtonMoreListing";
import IconButtonMoreEntityProps from "Features/entityProps/components/IconButtonMoreEntityProps";

export default function IconButtonMoreInHeader() {
  // data

  const {value: listing} = useSelectedListing();
  const entityModel = useListingEntityModel(listing);

  // helper

  // const type = listing?.type ?? "DEFAULT";

  const isZones = entityModel?.type === "ZONE_ENTITY_MODEL";

  // helpers

  const componentByEntityModel = {
    ZONE_ENTITY_MODEL: <IconButtonMoreZones />,
    ENTITY_PROPS: <IconButtonMoreEntityProps />,
  };

  const component = componentByEntityModel[entityModel?.type] ?? (
    <IconButtonMoreListing />
  );

  return component;
}
