import { useLiveQuery } from "dexie-react-hooks";

import { Box, Typography } from "@mui/material";

import db from "App/db/db";

export default function SectionPortfolioPageArticles({ pageId }) {
  // data

  const debugData = useLiveQuery(async () => {
    if (!pageId) return null;

    // 1. Get baseMapContainers for this page
    const containers = (
      await db.portfolioBaseMapContainers
        .where("portfolioPageId")
        .equals(pageId)
        .toArray()
    ).filter((r) => !r.deletedAt);

    const baseMapIds = containers.map((c) => c.baseMapId).filter(Boolean);
    if (!baseMapIds.length) return { containers, annotations: [], listings: [] };

    // 2. Get annotations for all baseMaps on the page
    const annotationArrays = await Promise.all(
      baseMapIds.map((bmId) =>
        db.annotations
          .where("baseMapId")
          .equals(bmId)
          .toArray()
          .then((arr) => arr.filter((r) => !r.deletedAt && !r.isBaseMapAnnotation))
      )
    );
    const annotations = annotationArrays.flat();

    // 3. Collect unique listingIds from annotations
    const listingIds = [
      ...new Set(annotations.map((a) => a.listingId).filter(Boolean)),
    ];

    // 4. Fetch listings
    const listings = listingIds.length
      ? (await db.listings.bulkGet(listingIds)).filter(Boolean)
      : [];

    // 5. Build articlesNomenclatures per listing
    const listingsWithNomenclatures = listings.map((listing) => ({
      id: listing.id,
      name: listing.name,
      key: listing.key,
      articlesNomenclatures: listing?.metadata?.nomenclature?.items ?? [],
    }));

    return { containers, annotations, listings: listingsWithNomenclatures };
  }, [pageId]);

  // helpers

  const hasArticles = debugData?.listings?.some(
    (l) => l.articlesNomenclatures.length > 0
  );

  // handlers

  function handleDebugClick() {
    if (!debugData) return;
    console.group("[SectionPortfolioPageArticles] Debug info");
    console.log("BaseMapContainers:", debugData.containers);
    console.log("Annotations:", debugData.annotations);
    debugData.listings.forEach((listing) => {
      console.group(`Listing: ${listing.name} (${listing.id})`);
      console.log("articlesNomenclatures:", listing.articlesNomenclatures);
      console.groupEnd();
    });
    console.groupEnd();
  }

  // render

  if (!hasArticles) {
    return (
      <Box
        sx={{
          bgcolor: "white",
          borderRadius: 1,
          border: (theme) => `1px solid ${theme.palette.divider}`,
          overflow: "hidden",
        }}
      >
        <Box sx={{ px: 2, pt: 1.5, pb: 0.5 }}>
          <Typography variant="body2" sx={{ fontWeight: "bold" }}>
            Articles
          </Typography>
        </Box>
        <Box sx={{ px: 2, pb: 1.5 }}>
          <Typography
            variant="body2"
            color="text.secondary"
            onClick={handleDebugClick}
            sx={{ cursor: "pointer", "&:hover": { color: "text.primary" } }}
          >
            Aucun article
          </Typography>
        </Box>
      </Box>
    );
  }

  return (
    <Box
      sx={{
        bgcolor: "white",
        borderRadius: 1,
        border: (theme) => `1px solid ${theme.palette.divider}`,
        overflow: "hidden",
      }}
    >
      <Box sx={{ px: 2, pt: 1.5, pb: 0.5 }}>
        <Typography variant="body2" sx={{ fontWeight: "bold" }}>
          Articles
        </Typography>
      </Box>
      <Box sx={{ px: 2, pb: 1.5 }}>
        {debugData?.listings?.map((listing) => (
          <Typography key={listing.id} variant="body2">
            {listing.name} ({listing.articlesNomenclatures.length})
          </Typography>
        ))}
      </Box>
    </Box>
  );
}
