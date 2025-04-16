import stableStringify from "fast-json-stable-stringify";
import {makeGetProjectsByOptions} from "../selectors/projectsSelectors";

const selectorCache = new Map();

export function getProjectSelector(options) {
  const key = stableStringify(options);

  if (!selectorCache.has(key)) {
    const selector = makeGetProjectsByOptions(options);
    selectorCache.set(key, selector);
  }

  return selectorCache.get(key);
}
