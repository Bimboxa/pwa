import useSelectedListing from "Features/listings/hooks/useSelectedListing";
import useNomenclatureItemsFromListing from "../hooks/useNomenclatureItemsFromListing";

import {Box} from "@mui/material";
import TreeGeneric from "Features/tree/components/TreeGeneric";

export default function SectionNomenclatureInListPanel() {
  // data

  const {value: listing} = useSelectedListing();
  const items = useNomenclatureItemsFromListing({listing});

  return <Box>{items && <TreeGeneric items={items} />}</Box>;
}
