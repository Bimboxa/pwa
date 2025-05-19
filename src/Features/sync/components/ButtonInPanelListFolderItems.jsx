import {useState} from "react";

import {List, ListItem, ListItemText} from "@mui/material";

import DialogGeneric from "Features/layout/components/DialogGeneric";
import ButtonInPanel from "Features/layout/components/ButtonInPanel";
import useRemoteContainer from "../hooks/useRemoteContainer";
import RemoteProvider from "../js/RemoteProvider";
import useRemoteToken from "../hooks/useRemoteToken";
import BoxFlexVStretch from "Features/layout/components/BoxFlexVStretch";

export default function ButtonInPanelListFolderItems({path}) {
  // data

  const remoteContainer = useRemoteContainer();
  const {value: accessToken} = useRemoteToken();

  // strings

  const filesS = `Contenu ${remoteContainer.service}`;

  // state

  const [open, setOpen] = useState(false);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);

  // handlers

  async function handleClick() {
    const remoteProvider = new RemoteProvider({
      accessToken,
      provider: remoteContainer.service,
    });

    setLoading(true);
    let items = await remoteProvider.listFolderItems(path);
    items = items.filter((item) => item[".tag"] === "folder");
    console.log("items", items);
    setLoading(false);
    setItems(items);
    setOpen(true);
  }

  function handleClose() {
    setOpen(false);
    setItems([]);
  }

  return (
    <>
      <DialogGeneric open={open} onClose={handleClose} title={filesS}>
        <BoxFlexVStretch sx={{overflow: "auto"}}>
          <List dense>
            {items.map((item) => (
              <ListItem divider>
                <ListItemText>{item.name}</ListItemText>
              </ListItem>
            ))}
          </List>
        </BoxFlexVStretch>
      </DialogGeneric>
      <ButtonInPanel label={filesS} loading={loading} onClick={handleClick} />
    </>
  );
}
