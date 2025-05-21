import {useState} from "react";

import useRemoteProvider from "../hooks/useRemoteProvider";

import {ListItemButton, ListItemText, List} from "@mui/material";

import DialogCreateRemoteItem from "./DialogCreateRemoteItem";
import BlockLoading from "Features/layout/components/BlockLoading";

import getRemoteItemPath from "../utils/getRemoteItemPath";
import jsonFileToObjectAsync from "Features/files/utils/jsonFileToObjectAsync";

export default function ListRemoteItems({
  items,
  onClick,
  syncFileType,
  loading,
}) {
  // data

  const remoteProvider = useRemoteProvider();

  // state

  const [open, setOpen] = useState(false);

  // state - props used in dialog to create the remoteFile for the item;
  const [item, setItem] = useState(null);
  const [itemPath, setItemPath] = useState(null);

  const [loadingRemoteItem, setLoadingRemoteItem] = useState(false);

  // handlers

  async function handleClick(item) {
    // get remote item metadata
    console.log("[click] item", item);
    setLoadingRemoteItem(true);
    // the item may not exist yet on dropbox.
    // ex: projects come from _openedProjects, not directly the list of items.
    //
    const {path} = await getRemoteItemPath({
      type: syncFileType,
      remoteContainer,
      item,
    });
    //
    setItem(item);
    setItemPath(path);
    //
    const metadata = await remoteProvider.fetchFileMetadata(path);
    setLoadingRemoteItem(false);

    const lastModifiedAt = metadata?.lastModifiedAt;

    //
    if (!lastModifiedAt) {
      setOpen(true);
    } else {
      setLoadingRemoteItem(true);
      const itemFile = await remoteProvider.downloadFile(path);
      const _item = await jsonFileToObjectAsync(itemFile);
      setLoadingRemoteItem(false);
      onClick({..._item?.data, lastModifiedAt});
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
        item={item}
        syncFileType={syncFileType}
        itemPath={itemPath}
        type="FILE"
        onCreated={handleRemoteItemCreated}
      />
    </>
  );
}
