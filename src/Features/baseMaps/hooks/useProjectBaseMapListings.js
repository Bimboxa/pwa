import useAppConfig from "Features/appConfig/hooks/useAppConfig";
import { useSelector } from "react-redux";
import { useLiveQuery } from "dexie-react-hooks";
import db from "App/db/db";

export default function useProjectBaseMapListings() {
  const projectId = useSelector((s) => s.projects.selectedProjectId);
  const appConfig = useAppConfig();

  return useLiveQuery(async () => {
    if (!projectId) return null;

    let listings = await db.listings
      .where("projectId")
      .equals(projectId)
      .toArray();

    // filter by baseMap
    listings = listings.map((listing) => ({
      ...listing,
      entityModel: appConfig?.entityModelsObject?.[listing?.entityModelKey],
    }));

    listings = listings.filter((l) => l.entityModel?.type === "BASE_MAP");

    return listings;
  }, [projectId]);
}
