import useSelectedListing from "Features/listings/hooks/useSelectedListing";

import {ListItemButton, ListItemIcon, ListItemText} from "@mui/material";
import {AddCircle as Add} from "@mui/icons-material";

export default function IconButtonCreateEntity({listing}) {
  // data

  const {value: _listing} = useSelectedListing({withEntityModel: true});
  listing = listing ?? _listing;

  // helper - listings props

  const newS = listing?.entityModel?.strings?.labelNew ?? "Nouveau";
  const color = listing?.color;

  return (
    <ListItemButton divider>
      <ListItemIcon>
        <Add sx={{color}} />
      </ListItemIcon>
      <ListItemText sx={{color: "text.secondary"}}>{newS}</ListItemText>
    </ListItemButton>
  );
}
