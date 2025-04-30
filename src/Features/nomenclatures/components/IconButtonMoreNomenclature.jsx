import useCreateZonesTree from "../hooks/useCreateZonesTree";

import {MoreHoriz as More} from "@mui/icons-material";
import {Icon} from "@mui/material";

import IconButtonMenu from "Features/layout/components/IconButtonMenu";
import useSelectedListing from "Features/listings/hooks/useSelectedListing";

export default function IconButtonMoreNomenclature() {
  // data

  const {value: listing} = useSelectedListing();

  // handlers

  function handleSetNomenclatureFromOrgaData() {
    console.log("listing", listing);
  }

  // actions

  const actions = [
    {
      label: "Récupérer les données",
      handler: handleSetNomenclatureFromOrgaData,
    },
  ];
  return <IconButtonMenu icon={<Icon as={More} />} actions={actions} />;
}
