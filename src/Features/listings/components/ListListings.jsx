import {List, ListItemButton, ListItemText} from "@mui/material";

export default function ListListings({listings, selection, onClick}) {
  return (
    <List>
      {listings.map((listing) => (
        <ListItemButton
          key={listing.id}
          selected={selection.includes(listing.id)}
          onClick={() => onClick(listing)}
        >
          <ListItemText primary={listing.name} />
        </ListItemButton>
      ))}
    </List>
  );
}
