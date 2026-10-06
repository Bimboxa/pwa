/* eslint-disable react/prop-types */
import { useMemo } from "react";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import buildTutorialMarkdownComponents from "./tutorialMarkdownComponents";

export default function TutorialMarkdown({ markdown, orgaCode, basePath }) {
  const components = useMemo(
    () => buildTutorialMarkdownComponents({ orgaCode, basePath }),
    [orgaCode, basePath]
  );

  // skipHtml: tutorial files start with an HTML comment documenting the
  // conventions; without this flag react-markdown renders raw HTML as text.
  return (
    <ReactMarkdown remarkPlugins={[remarkGfm]} components={components} skipHtml>
      {markdown}
    </ReactMarkdown>
  );
}
