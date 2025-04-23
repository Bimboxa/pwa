import {useState} from "react";

import useFetchRemoteItemMetadata from "../hooks/useFetchRemoteItemMetadata";
import useRemoteContainer from "../hooks/useRemoteContainer";
import useDownloadFile from "../hooks/useDownloadFile";

import {ListItemButton, ListItemText, List} from "@mui/material";

import DialogCreateRemoteItem from "./DialogCreateRemoteItem";
import BlockLoading from "Features/layout/components/BlockLoading";

import getRemoteItemPath from "../utils/getRemoteItemPath";
import jsonFileToObjectAsync from "Features/files/utils/jsonFileToObjectAsync";

export default function ListRemoteItems({items, onClick, itemType, loading}) {
  // data

  const remoteContainer = useRemoteContainer();

  // data - func

  const fetchRemoteItemMetadata = useFetchRemoteItemMetadata();
  const downloadFile = useDownloadFile();

  // state

  const [open, setOpen] = useState(false);
  const [item, setItem] = useState(null);
  const [itemPath, setItemPath] = useState(null);

  const [loadingRemoteItem, setLoadingRemoteItem] = useState(false);

  // handlers

  async function handleClick(item) {
    console.log("[click] item", item);
    setLoadingRemoteItem(true);
    // the item may not exist yet on dropbox.
    // ex: projects come from _openedProjects, not directly the list of items.
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
    setLoadingRemoteItem(false);
    const metadata = result?.value;
    //
    if (!metadata) {
      setOpen(true);
    } else {
      setLoadingRemoteItem(true);
      const itemFile = await downloadFile(path);
      const _item = await jsonFileToObjectAsync(itemFile);
      setLoadingRemoteItem(false);
      onClick(_item?.data);
    }
  }

  function handleRemoteItemCreated(remoteItem) {
    setOpen(false);
    onClick(remoteItem);
  }

  if (loading || loadingRemoteItem) {
    return <BlockLoading />;
  }

  return (
    <>
      <List dense>
        {items?.map((item) => {
          const label = item.label || item.name;
          return (
            <ListItemButton
              divider
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
