import {useDispatch} from "react-redux";

import useSelectedListing from "../hooks/useSelectedListing";

import IconListingVariantClickabe from "./IconListingVariantClickable";
import {Icon} from "@mui/material";

export default function IconButtonListingSelector() {
  const dispatch = useDispatch();

  // data

  const selectedListing = useSelectedListing();

  // handlers

  function handleIconButtonClick() {}
  return (
    <IconListingVariantClickabe
      listing={selectedListing}
      onClick={handleIconButtonClick}
    />
  );
}
