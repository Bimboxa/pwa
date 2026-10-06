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

  return (
    <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
      {markdown}
    </ReactMarkdown>
  );
}
