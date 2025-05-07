import Fuse from "fuse.js";

export default function getFoundItems({items, searchText, searchKeys}) {
  // edge case

  if (!items) {
    return null;
  }

  if (!searchText || searchText.length === 0) {
    return items;
  }

  const fuseOptions = {
    keys: searchKeys,
    threshold: 0.3,
  };

  const fuse = new Fuse(items, fuseOptions);
  const results = fuse.search(searchText);

  return results?.map((r) => r.item);
}
