import {useState} from "react";

import {useSelector} from "react-redux";

import {useLiveQuery} from "dexie-react-hooks";
import db from "App/db/db";

export default function useListings(options) {
  // options

  const filterByProjectId = options?.filterByProjectId;
  const filterBySelectedProject = options?.filterBySelectedProject;
  const filterBySelectedScope = options?.filterBySelectedScope;

  // state

  const [loading, setLoading] = useState(true);

  // data

  let listings = useLiveQuery(async (params) => {
    let listings = await db.listings.toArray();

    setLoading(false);

    return listings;
  });

  // filters

  if (filterByProjectId) {
    listings = listings.filter(
      (listing) => listing.projectId === filterByProjectId
    );
  }

  return listings;
}
