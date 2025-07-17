import { nanoid } from "@reduxjs/toolkit";

import { useSelector } from "react-redux";

import useCreateProject from "Features/projects/hooks/useCreateProject";
import useCreateListings from "Features/listings/hooks/useCreateListings";
import useCreateListing from "Features/listings/hooks/useCreateListing";
import useCreateEntity from "Features/entities/hooks/useCreateEntity";

import getAppConfigDefault from "Features/appConfig/services/getAppConfigDefault";
import getImageSizeAsync from "Features/misc/utils/getImageSize";

export default function useCreateOnboardingData() {
  // data

  const projectName = useSelector((s) => s.onboarding.projectName);
  const mapName = useSelector((s) => s.onboarding.mapName);
  const mapFile = useSelector((s) => s.onboarding.mapFile);
  const issuesListingName = useSelector((s) => s.onboarding.issuesListingName);

  // data - func

  const createProject = useCreateProject();
  const createListings = useCreateListings();
  const createListing = useCreateListing();
  const createEntity = useCreateEntity();

  // return

  return async () => {
    try {
      // appConfig

      const appConfig = await getAppConfigDefault();

      // project

      const _project = { id: nanoid(), name: projectName };
      const project = await createProject(_project);

      // mapsListing

      const presetMapListing =
        appConfig.presetListingsObject?.mapsGeneric ?? {};
      const _mapsListing = {
        id: nanoid(),
        projectId: project.id,
        ...presetMapListing,
      };
      const mapsListing = await createListing({ listing: _mapsListing });

      // map

      const imageSize = await getImageSizeAsync({ file: mapFile });
      const mapEntity = {
        label: mapName,
        image: {
          file: mapFile,
          imageSize,
          fileSize: mapFile.size,
          isImage: true,
        },
      };
      const entity = await createEntity(mapEntity, { listing: mapsListing });
      console.log("entity created: ", entity);

      // issuesListing

      const presetIssuesListing = appConfig.presetListingsObject?.issues ?? {};
      const _issuesListing = {
        id: nanoid(),
        projectId: project.id,
        ...presetIssuesListing,
        name: issuesListingName,
      };
      const issuesListing = await createListing({ listing: _issuesListing });

      // return

      return {
        project,
        map: entity,
        issuesListing,
      };
    } catch (e) {
      console.error("error creating data", e);
    }
  };
}
