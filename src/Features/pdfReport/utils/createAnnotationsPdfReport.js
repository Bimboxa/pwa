import downloadBlob from "Features/files/utils/downloadBlob";
import generateItemsGridPdf from "./generateItemsGridPdf";
import generateItemsGridPdfVariantH from "./generateItemsGridPdfVariantH";

export default async function createAnnotationsPdfReport(
  annotations,
  opts = {}
) {
  const variant = "VARIANT_H";

  // helpers issues => items

  let items = annotations.map((annotation) => {
    const templateProps = annotation.annotationTemplateProps;
    return {
      ...annotation,
      description: annotation.entity?.text || annotation.entity?.description,
      number: annotation.entity?.num ? Number(annotation.entity?.num) : "",
      imageUrl: annotation.entity?.image?.imageUrlClient,
      label: templateProps?.labelLegend || templateProps?.label || annotation.label,
    };
  });

  // Sort items by number in ascending order, converting number to integer
  items = items.sort((a, b) => {
    const numA = parseInt(a.number, 10) || 0;
    const numB = parseInt(b.number, 10) || 0;
    return numA - numB;
  });

  console.log("[createIssuesPdfReport] items", items);
  let blob;
  if (variant === "VARIANT_H") {
    blob = await generateItemsGridPdfVariantH(items, {
      spriteImage: opts.spriteImage,
      logoImage: opts.logoImage,
      title: opts.title,
      cartouche: opts.cartouche,
      headerTitleSize: 14,
      fontSizes: {
        label: 11, // bold “#num label” in the comments box
        description: 11, // description lines in the comments box
      },
    });
  } else {
    blob = await generateItemsGridPdf(items, {
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
  }

  return blob;

  //downloadBlob(blob, "issues.pdf");
}
