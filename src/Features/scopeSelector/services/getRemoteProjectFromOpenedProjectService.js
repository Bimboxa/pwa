import {nanoid} from "@reduxjs/toolkit";

import RemoteProvider from "Features/sync/js/RemoteProvider";

import createSyncTaskLocalToRemoteFromItem from "Features/sync/utils/createSyncTaskLocalToRemoteFromItem";
import syncTaskLocalToRemote from "Features/sync/services/syncTaskLocalToRemote";
import getRemoteItemPath from "Features/sync/utils/getRemoteItemPath";
import jsonFileToObjectAsync from "Features/files/utils/jsonFileToObjectAsync";

export default async function getRemoteProjectFromOpenedProjectService({
  openedProject,
  remoteProvider,
}) {
  // data
  const {path} = await getRemoteItemPath({
    item: openedProject,
    type: "PROJECT",
  });
  const projectFile = await remoteProvider.downloadFile(path);
  const result = await jsonFileToObjectAsync(projectFile);
  const _project = result.data;

  // create remote project if it doesn't exist
  if (!_project) {
    const project = {id: nanoid(), ...openedProject};
    const task = await createSyncTaskLocalToRemoteFromItem({
      item: project,
      type: "PROJECT",
    });
    await syncTaskLocalToRemote({task, remoteProvider});
    return project;
  } else {
    // return project
    return _project;
  }
}
