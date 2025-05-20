import {useState} from "react";

import {List, ListItem, ListItemText} from "@mui/material";

import DialogGeneric from "Features/layout/components/DialogGeneric";
import ButtonInPanel from "Features/layout/components/ButtonInPanel";
import useRemoteContainer from "../hooks/useRemoteContainer";
import RemoteProvider from "../js/RemoteProvider";
import useRemoteToken from "../hooks/useRemoteToken";
import BoxFlexVStretch from "Features/layout/components/BoxFlexVStretch";
import getUserAccountDropboxService from "Features/dropbox/services/getUserAccountDropboxService";
import searchFileDropboxService from "Features/dropbox/services/searchFileDropboxService";
import getItemMetadataDropboxService from "Features/dropbox/services/getItemMetadataDropboxService";

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
    setLoading(true);

    // get team namespaceId
    const _openedProjectsFile = await searchFileDropboxService({
      fileName: "_openedProjects.json",
      accessToken,
    });
    console.log("_openedProjectsFile", _openedProjectsFile);
    //const namespace_id = _openedProjectsFile?.metadata?.metadata?.namespace_id;
    const file_id = _openedProjectsFile?.metadata?.metadata?.id;

    // metadata
    let fileMetadata;
    if (file_id) {
      fileMetadata = await getItemMetadataDropboxService({
        accessToken,
        path: file_id,
      });
    }

    console.log("fileMetata", fileMetadata);
    const namespace_id = fileMetadata?.namespace_id;

    // team folder
    const userAccount = await getUserAccountDropboxService({accessToken});
    console.log("debug_2005 userAccount", userAccount);
    const rootInfo = userAccount.root_info;

    let options = {};
    if (namespace_id) {
      options.pathRoot = {
        ".tag": "namespace_id",
        namespace_id: namespace_id,
      };
    }

    //
    const remoteProvider = new RemoteProvider({
      accessToken,
      provider: remoteContainer.service,
      options,
    });

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
              <ListItem divider key={item.name}>
                <ListItemText>{item.name}</ListItemText>
              </ListItem>
            ))}
          </List>
        </BoxFlexVStretch>
      </DialogGeneric>
      <ButtonInPanel
        label={filesS}
        loading={loading}
        onClick={handleClick}
        bgcolor="white"
        color="text.primary"
      />
    </>
  );
}
