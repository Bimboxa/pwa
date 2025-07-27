import { List, ListItemButton } from "@mui/material";

export default function ListBaseMapsV2({ baseMaps, onClick }) {
  console.log("baseMaps__", baseMaps);
  return (
    <List>
      {baseMaps?.map((baseMap) => {
        return (
          <ListItemButton key={baseMap.id} onClick={() => onClick(baseMap)}>
            <img src={baseMap.imageProps.imageUrlClient} />
          </ListItemButton>
        );
      })}
    </List>
  );
}
