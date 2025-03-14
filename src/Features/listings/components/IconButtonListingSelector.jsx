import {useState} from "react";
import {useDispatch} from "react-redux";

import useSelectedListing from "../hooks/useSelectedListing";

import IconListingVariantClickable from "./IconListingVariantClickable";

import DialogFsSelectorListing from "./DialogFsSelectorListing";

export default function IconButtonListingSelector() {
  const dispatch = useDispatch();

  // state

  const [open, setOpen] = useState(false);

  // data

  const selectedListing = useSelectedListing();

  // handlers

  function handleIconButtonClick() {
    setOpen(true);
  }

  return (
    <>
      <IconListingVariantClickable
        listing={selectedListing}
        onClick={handleIconButtonClick}
        open={open}
      />
      <DialogFsSelectorListing open={open} onClose={() => setOpen(false)} />
    </>
  );
}
