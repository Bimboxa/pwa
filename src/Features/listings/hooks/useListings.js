import { useEffect, useMemo, useRef } from "react";
import { useSelector } from "react-redux";
import { useLiveQuery } from "dexie-react-hooks";

import db from "App/db/db";
import { getListingsSelector } from "../services/listingsSelectorCache";
import getObjectHash from "Features/misc/utils/getObjectHash";

export default function useListings(options) {
  // options

  const withFiles = options?.withFiles;

  // selector options (everything except Dexie-only options)

  const selectorOptions = useMemo(() => {
    if (!options) return {};
    const { withFiles: _wf, ...rest } = options;
    return rest;
  }, [getObjectHash(options)]);

  const selector = useMemo(
    () => getListingsSelector(selectorOptions),
    [getObjectHash(selectorOptions)]
  );

  // data from Redux (fast, memoized)

  const listings = useSelector((s) => selector(s));

  // enrich with files from Dexie (only when withFiles is true)

  const listingsIds = withFiles
    ? listings?.map((l) => l.id).sort().join(",") ?? ""
    : "";

  const blobUrlsRef = useRef([]);

  const enrichedListings = useLiveQuery(async () => {
    if (!withFiles || !listings?.length) return null;

    // revoke previous blob URLs
    blobUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
    blobUrlsRef.current = [];

    return Promise.all(
      listings.map(async (listing) => {
        if (!listing.metadata) return listing;

        const entriesWithFiles = Object.entries(listing.metadata).filter(
          ([, value]) => value?.fileName
        );
        if (entriesWithFiles.length === 0) return listing;

        const processedMetadata = { ...listing.metadata };
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
        return { ...listing, metadata: processedMetadata };
      })
    );
  }, [withFiles, listingsIds]);

  // cleanup blob URLs on unmount
  useEffect(() => {
    return () => {
      blobUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
      blobUrlsRef.current = [];
    };
  }, []);

  // result

  const value = withFiles && enrichedListings ? enrichedListings : listings;

  return { value, loading: false };
}
