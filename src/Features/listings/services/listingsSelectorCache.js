import stableStringify from "fast-json-stable-stringify";
import { makeGetListingsByOptions } from "../selectors/listingsSelectors";

const selectorCache = new Map();

export function getListingsSelector(options) {
  const key = stableStringify(options);

  if (!selectorCache.has(key)) {
    const selector = makeGetListingsByOptions(options);
    selectorCache.set(key, selector);
  }

  return selectorCache.get(key);
}
