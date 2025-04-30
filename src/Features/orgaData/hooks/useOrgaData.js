import db from "App/db/db";
import {useLiveQuery} from "dexie-react-hooks";
import getItemsByKey from "Features/misc/utils/getItemsByKey";

export default function useOrgaData(options) {
  const orgaData = useLiveQuery(async () => {
    console.log("[LiveQuery] orgaData");
    let items = await db.orgaData.toArray();
    console.log("[LiveQuery] orgaData items", items);

    // filter
    if (options.nomenclaturesOnly) {
      items = items.filter((item) => item.dataStructure === "NOMENCLATURE");
    }

    // options
    if (options.variant === "byKey") {
      return getItemsByKey(items, "key");
    }

    // default
    return items;
  });
  return orgaData;
}
