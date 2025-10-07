import downloadBlob from "Features/files/utils/downloadBlob";
import generateItemsGridPdf from "./generateItemsGridPdf";

export default async function createAnnotationsPdfReport(
  annotations,
  opts = {}
) {
  // helpers issues => items

  let items = annotations.map((annotation) => {
    return {
      ...annotation,
      description: annotation.entity?.text || annotation.entity?.description,
      number: annotation.entity?.num ?? "",
      imageUrl: annotation.entity?.image?.imageUrlClient,
    };
  });

  // Sort items by number in ascending order, converting number to integer
  items = items.sort((a, b) => {
    const numA = parseInt(a.number, 10) || 0;
    const numB = parseInt(b.number, 10) || 0;
    return numA - numB;
  });

  console.log("[createIssuesPdfReport] items", items);
  const blob = await generateItemsGridPdf(items, {
    pageSize: "A4",
    orientation: "portrait",
    spriteImage: opts.spriteImage,
    chipFontSize: 10,
    chipBorder: 1,
    overlayIconSize: 12,
    fontSizes: {
      label: 11, // bold “#num label” in the comments box
      description: 11, // description lines in the comments box
    },
  });

  return blob;

  //downloadBlob(blob, "issues.pdf");
}
