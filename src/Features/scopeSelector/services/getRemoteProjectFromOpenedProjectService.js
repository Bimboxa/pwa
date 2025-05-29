import {nanoid} from "@reduxjs/toolkit";

import createSyncTaskLocalToRemoteFromItem from "Features/sync/utils/createSyncTaskLocalToRemoteFromItem";
import syncTaskLocalToRemote from "Features/sync/services/syncTaskLocalToRemote";
import getRemoteItemPath from "Features/sync/utils/getRemoteItemPath";
import jsonFileToObjectAsync from "Features/files/utils/jsonFileToObjectAsync";

export default async function getRemoteProjectFromOpenedProjectService({
  openedProject,
  remoteProvider,
  remoteContainer,
}) {
  // data
  const {path} = await getRemoteItemPath({
    item: openedProject,
    type: "PROJECT",
    remoteContainer,
  });
  const projectFile = await remoteProvider.downloadFile(path);
  console.log("projectFile", projectFile);

  // create remote project if it doesn't exist
  if (!projectFile) {
    const project = {id: nanoid(), ...openedProject};
    const task = await createSyncTaskLocalToRemoteFromItem({
      item: project,
      type: "PROJECT",
      remoteContainer,
    });
    await syncTaskLocalToRemote({task, remoteProvider});
    return project;
  } else {
    const result = await jsonFileToObjectAsync(projectFile);
    const _project = result.data;

    // return project
    return _project;
  }
}
