import downloadBlob from "Features/files/utils/downloadBlob";
import generateItemsGridPdf from "./generateItemsGridPdf";

export default async function createIssuesPdfReport(issues, opts = {}) {
  // helpers issues => items

  const items = issues.map((issue) => {
    return {
      ...issue,
      number: issue.label,
      label: issue.annotation?.label,
      imageUrl: issue.image.imageUrlClient,
      description: issue.subLabel,
      iconKey: issue.annotation?.iconKey,
      fillColor: issue.annotation?.fillColor,
    };
  });

  console.log("[createIssuesPdfReport] items", items);
  const blob = await generateItemsGridPdf(items, {
    pageSize: "A4",
    orientation: "portrait",
    spriteImage: opts.spriteImage,
  });

  downloadBlob(blob, "issues.pdf");
}
