import {useState} from "react";

import useRemoteContainer from "../hooks/useRemoteContainer";
import useRemoteToken from "../hooks/useRemoteToken";

import {ListItemButton, ListItemText, List} from "@mui/material";

import DialogCreateRemoteItem from "./DialogCreateRemoteItem";
import BlockLoading from "Features/layout/components/BlockLoading";

import getRemoteItemPath from "../utils/getRemoteItemPath";
import jsonFileToObjectAsync from "Features/files/utils/jsonFileToObjectAsync";

import RemoteProvider from "../js/RemoteProvider";

export default function ListRemoteItems({items, onClick, itemType, loading}) {
  // data

  const remoteContainer = useRemoteContainer();
  const {value: accessToken} = useRemoteToken();

  // state

  const [open, setOpen] = useState(false);

  // state - props used in dialog to create the remoteFile for the item;
  const [item, setItem] = useState(null);
  const [itemPath, setItemPath] = useState(null);

  const [loadingRemoteItem, setLoadingRemoteItem] = useState(false);

  // handlers

  async function handleClick(item) {
    // init
    const remoteProvider = new RemoteProvider({
      accessToken,
      provider: remoteContainer.service,
    });

    // get remote item metadata
    console.log("[click] item", item);
    setLoadingRemoteItem(true);
    // the item may not exist yet on dropbox.
    // ex: projects come from _openedProjects, not directly the list of items.
    //
    const {path} = await getRemoteItemPath({
      type: itemType,
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
        itemType={itemType}
        itemPath={itemPath}
        type="FILE"
        onCreated={handleRemoteItemCreated}
      />
    </>
  );
}
