import BoxCenter from "Features/layout/components/BoxCenter";

export default function ViewerPdf({pdfFile}) {
  if (!pdfFile) return null;

  // helper

  const pdfUrl = URL.createObjectURL(pdfFile);

  return (
    <BoxCenter sx={{border: (theme) => `1px solid ${theme.palette.divider}`}}>
      <iframe
        src={pdfUrl}
        //type="application/pdf"
        style={{width: "100%", height: "100%", border: "none"}}
        title="PDF Viewer"
      />
    </BoxCenter>
  );
}
