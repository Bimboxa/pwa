import { useState, useCallback, useEffect, useRef } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";

import { useDispatch } from "react-redux";

import {
  setSelectedProjectId,
  triggerProjectsUpdate,
} from "Features/projects/projectsSlice";
import { setOnboardingIsActive } from "Features/onboarding/onboardingSlice";
import { triggerListingsUpdate } from "Features/listings/listingsSlice";
import {
  triggerAnnotationsUpdate,
  triggerAnnotationTemplatesUpdate,
} from "Features/annotations/annotationsSlice";
import { triggerEntitiesUpdate } from "Features/entities/entitiesSlice";

import unzipFilesAsync from "Features/files/utils/unzipFilesAsync";
import loadKrtoFile from "Features/krtoFile/services/loadKrtoFile";

export default function useAutoFetchAndLoadGlobalData() {
  const dispatch = useDispatch();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [queryParams] = useSearchParams();

  const baseUrl = `https://public.media.bimboxa.com`;

  const syncingRef = useRef(false);

  // Get dataPath from URL query parameters
  const dataPath = queryParams.get("dataPath");

  // Fetch the zip file
  console.log("Fetching data from:", dataPath);

  const fetchAndLoadData = useCallback(async () => {
    try {
      syncingRef.current = true;
      setLoading(true);
      setError(null);

      if (!dataPath) {
        throw new Error("No dataPath query parameter found in URL");
      }

      console.log("debug_161025 syncingRef =", syncingRef?.current);

      const response = await fetch(baseUrl + dataPath);

      if (!response.ok) {
        throw new Error(
          `Failed to fetch data: ${response.status} ${response.statusText}`
        );
      }

      // Get the zip blob
      const zipBlob = await response.blob();
      console.log("Fetched zip file, size:", zipBlob.size);

      // Unzip the files
      const files = await unzipFilesAsync(zipBlob);
      console.log(
        "Unzipped files:",
        files.map((f) => f.name)
      );

      // Find the KRTO file (should have .krto extension)
      const krtoFile = files.find((file) => file.name.endsWith(".krto"));

      if (!krtoFile) {
        throw new Error("No .krto file found in the zip archive");
      }

      syncingRef.current = false;
      console.log("Loading KRTO file:", krtoFile.name);

      // Load the KRTO file into the database
      const project = await loadKrtoFile(krtoFile);

      console.log("Successfully loaded project:", project?.name);

      // Select project
      dispatch(setSelectedProjectId(project.id));
      dispatch(setOnboardingIsActive(false));
      dispatch(triggerProjectsUpdate());
      dispatch(triggerListingsUpdate());

      dispatch(triggerEntitiesUpdate());
      dispatch(triggerAnnotationsUpdate());
      dispatch(triggerAnnotationTemplatesUpdate());

      navigate("/");

      // Close the dialog
      return project;
    } catch (err) {
      console.error("Error fetching and loading data:", err);
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [dataPath]);

  useEffect(() => {
    console.log("debug_161025 queryParams =", dataPath);
    if (dataPath && !syncingRef?.current) {
      fetchAndLoadData();
    }
  }, [dataPath]);
}
