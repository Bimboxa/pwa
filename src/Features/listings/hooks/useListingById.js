import { useEffect, useRef } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import useAppConfig from "Features/appConfig/hooks/useAppConfig";

import db from "App/db/db";

export default function useListingById(id, options) {
  // options

  const withFiles = options?.withFiles;

  // data

  const appConfig = useAppConfig();

  const blobUrlsRef = useRef([]);

  // main

  const listing = useLiveQuery(async () => {
    if (id) {
      const _listing = await db.listings.get(id);

      // fallback for listings created before entityModel was stored
      const entityModel =
        _listing?.entityModel ??
        appConfig?.entityModelsObject?.[_listing?.entityModelKey] ??
        null;

      const result = { ..._listing, entityModel };

      // load metadata files
      if (withFiles && result.metadata) {
        // revoke previous blob URLs
        blobUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
        blobUrlsRef.current = [];

        const processedMetadata = { ...result.metadata };
        const entriesWithFiles = Object.entries(result.metadata).filter(
          ([, value]) => value?.fileName
        );

        await Promise.all(
          entriesWithFiles.map(async ([key, value]) => {
            const file = await db.files.get(value.fileName);
            if (file && file.fileArrayBuffer) {
              const fileUrlClient = URL.createObjectURL(
                new Blob([file.fileArrayBuffer], { type: file.fileMime })
              );
              blobUrlsRef.current.push(fileUrlClient);
              processedMetadata[key] = {
                ...value,
                file,
                fileUrlClient,
              };
            }
          })
        );

        result.metadata = processedMetadata;
      }

      return result;
    }
  }, [id, appConfig?.version, withFiles]);

  // cleanup blob URLs on unmount
  useEffect(() => {
    return () => {
      blobUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
      blobUrlsRef.current = [];
    };
  }, []);

  return listing;
}
