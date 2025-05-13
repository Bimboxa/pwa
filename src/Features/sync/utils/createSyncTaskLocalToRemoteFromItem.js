import getRemoteItemPath from "./getRemoteItemPath";

export default async function createSyncTaskLocalToRemoteFromItem({
  item,
  type,
}) {
  const {path} = await getRemoteItemPath({
    item: openedProject,
    type: "PROJECT",
  });

  switch (type) {
    case "PROJECT": {
      return {
        entity: item,
        filePath: path,
      };
    }
    default: {
      return;
    }
  }
}
