import db from "App/db/db";
import {filter} from "jszip";

export default async function getTableEntriesFromFilters(table, filters) {
  // edge case

  if (!table || !Array.isArray(filters) || filters.length === 0) return null;

  // main

  try {
    const [first, ...rest] = filters;

    // first filter
    let entries;
    if (first.in) {
      entries = await db[table]
        .where(first.key)
        .anyOf(first.in || [])
        .toArray();
    } else if (first.value) {
      entries = await db[table].where(first.key).equals(first.value).toArray();
    }

    // other filters
    if (rest.length > 0) {
      entries = entries.filter((entry) =>
        rest.every((f) =>
          f.in ? f.in.includes(entry[f.key]) : entry[f.key] === f.value
        )
      );
    }

    // result

    return entries;
  } catch (e) {
    console.log("error extracting entries from db", e);
  }
}
