import * as Excel from "exceljs";

import { Download } from "@mui/icons-material";

import ButtonGeneric from "Features/layout/components/ButtonGeneric";

import createSheetAnnotations from "../utils/createSheetAnnotations";
import downloadBlob from "Features/files/utils/downloadBlob";


export default function ButtonCreateExcelAnnotations({ annotations }) {

    // strings

    const labelS = "Export excel";

    async function handleCreateExcel() {
        console.log("annotations", annotations);
        const workbook = new Excel.Workbook();
        createSheetAnnotations(workbook, annotations);
        const buffer = await workbook.xlsx.writeBuffer();
        const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
        downloadBlob(blob, "data.xlsx")
    }



    return (
        <ButtonGeneric
            //variant="contained"
            //color="primary"
            startIcon={<Download />}
            onClick={handleCreateExcel}
            label={labelS}
        />
    );
}