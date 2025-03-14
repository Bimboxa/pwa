import useSelectedListing from "Features/listings/hooks/useSelectedListing";

import {Box} from "@mui/material";
import ButtonCreateListingItem from "Features/listings/components/ButtonCreateListingItem";

export default function ListPanelBottom() {
  // data

  const listing = useSelectedListing();

  return (
    <Box sx={{width: 1, p: 1}}>
      <ButtonCreateListingItem listing={listing} />
    </Box>
  );
}
