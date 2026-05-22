import {useEffect, useMemo, useRef} from "react";

import {useLocation, useNavigate} from "react-router-dom";

import {Box, Typography} from "@mui/material";

import {DOCUMENTATION_ROOT} from "../constants/documentationRoutes";
import useDocCustomCss from "../hooks/useDocCustomCss";
import useDocPage from "../hooks/useDocPage";
import useDocumentationConfig from "../hooks/useDocumentationConfig";
import useHeadingsOutline from "../hooks/useHeadingsOutline";
import flattenSidebar from "../utils/flattenSidebar";

import DocumentationContent from "./DocumentationContent";
import DocumentationHeader from "./DocumentationHeader";
import DocumentationOutline from "./DocumentationOutline";
import DocumentationSidebar from "./DocumentationSidebar";
import DocumentationWipBanner from "./DocumentationWipBanner";

export default function PageDocumentation() {
  const documentation = useDocumentationConfig();
  const location = useLocation();
  const navigate = useNavigate();
  const contentRef = useRef(null);

  useDocCustomCss(documentation?.customCss);

  const pages = useMemo(
    () => flattenSidebar(documentation?.sidebar),
    [documentation]
  );

  const subPath = location.pathname
    .replace(new RegExp(`^${DOCUMENTATION_ROOT}/?`), "")
    .replace(/\/$/, "");

  const pageId = subPath || pages[0]?.id || null;

  useEffect(() => {
    if (!subPath && pages[0]?.id) {
      navigate(`${DOCUMENTATION_ROOT}/${pages[0].id}`, {replace: true});
    }
  }, [subPath, pages, navigate]);

  // Reset scroll when changing page
  useEffect(() => {
    if (contentRef.current) contentRef.current.scrollTop = 0;
  }, [pageId]);

  const {status, content, frontmatter} = useDocPage(
    pageId,
    documentation?.pageLoaders
  );

  const {headings, activeId} = useHeadingsOutline(content, contentRef);

  // Title from frontmatter, else from sidebar entry, else "Documentation"
  const sidebarEntry = pages.find((p) => p.id === pageId);
  const headerTitle =
    frontmatter?.title || sidebarEntry?.title || "Documentation";

  if (!documentation?.enabled) {
    return (
      <Box
        sx={{
          height: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexDirection: "column",
          gap: 1,
          p: 4,
        }}
      >
        <Typography variant="h6">Documentation is not available</Typography>
        <Typography variant="body2" color="text.secondary">
          No documentation has been configured for this organization.
        </Typography>
      </Box>
    );
  }

  return (
    <Box
      className="doc-root"
      sx={{
        height: "100vh",
        display: "flex",
        flexDirection: "column",
        bgcolor: "background.paper",
      }}
    >
      <DocumentationHeader title={headerTitle} />
      <DocumentationWipBanner />
      <Box sx={{display: "flex", flex: 1, minHeight: 0}}>
        <DocumentationSidebar
          sidebar={documentation.sidebar}
          currentPageId={pageId}
        />
        <DocumentationContent
          ref={contentRef}
          status={status}
          content={content}
          pageId={pageId}
          imageLoaders={documentation.imageLoaders}
        />
        <DocumentationOutline
          headings={headings}
          activeId={activeId}
          scrollRoot={contentRef}
        />
      </Box>
    </Box>
  );
}
