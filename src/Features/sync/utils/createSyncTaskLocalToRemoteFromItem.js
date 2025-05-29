import getRemoteItemPath from "./getRemoteItemPath";

export default async function createSyncTaskLocalToRemoteFromItem({
  item,
  type,
  remoteContainer,
}) {
  const {path} = await getRemoteItemPath({
    item,
    type,
    remoteContainer,
  });

  switch (type) {
    case "PROJECT": {
      return {
        entry: item,
        filePath: path,
      };
    }
    case "SCOPE": {
      return {
        entry: item,
        filePath: path,
      };
    }
    case "LISTING": {
      return {
        entry: item,
        filePath: path,
      };
    }
    default: {
      return;
    }
  }
}
