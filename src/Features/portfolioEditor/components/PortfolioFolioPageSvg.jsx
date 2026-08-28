import { useState, useEffect } from "react";
import { useLiveQuery } from "dexie-react-hooks";

import { useDispatch, useSelector } from "react-redux";

import { setSelectedItem } from "Features/selection/selectionSlice";
import { selectSelectedItems } from "Features/selection/selectionSlice";

import { Box } from "@mui/material";

import useResourceFile from "Features/resources/hooks/useResourceFile";
import usePdfDocument from "Features/pdf/hooks/usePdfDocument";
import usePdfPageImageUrl from "Features/baseMapCreator/hooks/usePdfPageImageUrl";
import useDisplayedPortfolio from "Features/portfolios/hooks/useDisplayedPortfolio";
import useTitleBlockManifest from "Features/titleBlocks/hooks/useTitleBlockManifest";
import usePortfolioPageFrame from "Features/portfolios/hooks/usePortfolioPageFrame";

import PortfolioHeaderSvg from "./PortfolioHeaderSvg";
import PortfolioTitleBarSvg from "./PortfolioTitleBarSvg";
import PortfolioDetailRefSvg from "./PortfolioDetailRefSvg";

import getPageDimensions from "../utils/getPageDimensions";
import { getCartoucheRectBottomRight } from "../utils/getPageLayout";

import db from "App/db/db";

// Folio page (type "FOLIO_PAGE"): renders the PDF page referenced by
// page.folio as a full-bleed image, with the cartouche bottom-right on top.
// Falls back to the snapshot thumbnail stored on the folio when the source
// PDF is not available locally (post-Krto-import). No containers.
export default function PortfolioFolioPageSvg({
  page,
  pageIndex,
  totalPages,
  zoom,
}) {
  const dispatch = useDispatch();

  // strings

  const missingFileS = "Fichier PDF absent";

  // data

  const folio = page.folio;

  const selectedItems = useSelector(selectSelectedItems);

  const { value: portfolio } = useDisplayedPortfolio();
  const manifest = useTitleBlockManifest(portfolio);
  const pageFrame = usePortfolioPageFrame();

  const resource = useLiveQuery(async () => {
    if (!folio?.resourceId) return null;
    return (await db.resources.get(folio.resourceId)) ?? null;
  }, [folio?.resourceId]);

  const resourceMissing =
    resource !== undefined && (!resource || resource.deletedAt);

  const { file, fileIsMissing } = useResourceFile(
    resourceMissing ? null : resource
  );
  const { pdfDocument } = usePdfDocument(file);
  const { imageUrl } = usePdfPageImageUrl(
    pdfDocument,
    folio?.pageNumber ?? 1,
    folio?.rotation ?? 0
  );

  // state

  const [pdfDims, setPdfDims] = useState(null);

  // effects - real page dimensions (PDF points) once the document is loaded

  useEffect(() => {
    if (!pdfDocument) {
      setPdfDims(null);
      return;
    }
    let cancelled = false;
    pdfDocument
      .getPage(folio?.pageNumber ?? 1)
      .then((pdfPage) => {
        // absolute rotation, same convention as renderPageToPngBlob
        const viewport = pdfPage.getViewport({
          scale: 1,
          rotation: folio?.rotation ?? 0,
        });
        if (!cancelled)
          setPdfDims({ width: viewport.width, height: viewport.height });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [pdfDocument, folio?.pageNumber, folio?.rotation]);

  // helpers

  const isSelected = selectedItems.some(
    (i) => i.id === page.id && i.type === "PORTFOLIO_PAGE"
  );
  const dims = pdfDims ?? getPageDimensions(page.format, page.orientation);
  const src = imageUrl ?? folio?.thumbnail ?? null;
  // margin consistent with framed pages; the frame itself is not rendered on
  // folio pages (the source PDF already carries its own frame)
  const cartouche = getCartoucheRectBottomRight(
    dims,
    manifest.height,
    pageFrame
  );

  // handlers

  function handleClick(e) {
    e.stopPropagation();
    dispatch(
      setSelectedItem({
        id: page.id,
        type: "PORTFOLIO_PAGE",
        portfolioId: page.listingId,
      })
    );
  }

  // render

  return (
    <Box
      onClick={handleClick}
      sx={{
        bgcolor: "white",
        cursor: "pointer",
        boxShadow: isSelected
          ? (theme) => `0 0 0 3px ${theme.palette.viewers.portfolio}`
          : "0 2px 8px rgba(0,0,0,0.15)",
        borderRadius: "2px",
      }}
    >
      <svg
        data-portfolio-page-id={page.id}
        width={dims.width}
        height={dims.height}
        viewBox={`0 0 ${dims.width} ${dims.height}`}
        style={{ display: "block", background: "white" }}
      >
        {src && (
          <image
            href={src}
            x="0"
            y="0"
            width={dims.width}
            height={dims.height}
            preserveAspectRatio="xMidYMid meet"
          />
        )}
        {!src && (fileIsMissing || resourceMissing) && (
          <text
            x={dims.width / 2}
            y={dims.height / 2}
            textAnchor="middle"
            fill="#999"
            fontSize="16"
          >
            {missingFileS}
          </text>
        )}
        {cartouche && (
          <PortfolioHeaderSvg
            page={page}
            pageIndex={pageIndex}
            totalPages={totalPages}
            layout={{ variant: "BOTTOM_RIGHT", cartouche, titleBar: null }}
          />
        )}
        <PortfolioTitleBarSvg
          page={page}
          portfolio={portfolio}
          titleBar={null}
          pageDims={dims}
          pageFrame={pageFrame}
          zoom={zoom}
        />
        <PortfolioDetailRefSvg
          page={page}
          portfolio={portfolio}
          pageDims={dims}
          pageFrame={pageFrame}
          zoom={zoom}
        />
      </svg>
    </Box>
  );
}
