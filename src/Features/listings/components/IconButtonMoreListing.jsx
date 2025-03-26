import {useState} from "react";

import {useSelector} from "react-redux";

import useDeleteListing from "../hooks/useDeleteListing";

import {MoreHoriz} from "@mui/icons-material";

import IconButtonMenu from "Features/layout/components/IconButtonMenu";
import DialogDeleteRessource from "Features/layout/components/DialogDeleteRessource";

export default function IconButtonMoreListing() {
  // state

  const [openDelete, setOpenDelete] = useState(false);

  // data

  const listingId = useSelector((s) => s.listings.selectedListingId);
  const deleteListing = useDeleteListing();

  // actions

  const actions = [
    {
      label: "Supprimer",
      handler: () => setOpenDelete(true),
    },
  ];

  return (
    <>
      <IconButtonMenu actions={actions} icon={<MoreHoriz />} />

      <DialogDeleteRessource
        open={openDelete}
        onClose={() => setOpenDelete(false)}
        onConfirmAsync={() => deleteListing(listingId)}
      />
    </>
  );
}
