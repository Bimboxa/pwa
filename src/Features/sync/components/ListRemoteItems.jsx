import {useState} from "react";

import useFetchRemoteItemMetadata from "../hooks/useFetchRemoteItemMetadata";
import useRemoteContainer from "../hooks/useRemoteContainer";

import {ListItemButton, ListItemText, List} from "@mui/material";
import DialogCreateRemoteItem from "./DialogCreateRemoteItem";

import getRemoteItemPath from "../utils/getRemoteItemPath";

export default function ListRemoteItems({items, onClick, itemType}) {
  // data

  const remoteContainer = useRemoteContainer();
  console.log("[ListRemoteItems] remoteContainer", remoteContainer);

  // data - func

  const fetchRemoteItemMetadata = useFetchRemoteItemMetadata();

  // state

  const [open, setOpen] = useState(false);
  const [item, setItem] = useState(null);
  const [itemPath, setItemPath] = useState(null);

  // handlers

  async function handleClick(item) {
    console.log("[click] item", item);
    //
    const path = getRemoteItemPath({
      type: itemType,
      remoteContainer,
      item,
    });
    //
    setItem(item);
    setItemPath(path);
    //
    const result = await fetchRemoteItemMetadata(path);
    const metadata = result?.value;
    //
    if (!metadata) {
      setOpen(true);
    } else {
      onClick(item);
    }
  }

  function handleRemoteItemCreated(remoteItem) {
    setOpen(false);
    onClick(remoteItem);
  }

  return (
    <>
      <List>
        {items?.map((item) => {
          const label = item.label || item.name;
          return (
            <ListItemButton
              key={item.clientId}
              onClick={() => handleClick(item)}
            >
              <ListItemText>{label}</ListItemText>
            </ListItemButton>
          );
        })}
      </List>
      <DialogCreateRemoteItem
        open={open}
        onClose={() => setOpen(false)}
        itemPath={itemPath}
        item={item}
        type="FILE"
        onCreated={handleRemoteItemCreated}
      />
    </>
  );
}
