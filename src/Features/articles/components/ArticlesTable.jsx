import {
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
} from "@mui/material";

export default function ArticlesTable({ articles }) {
  return (
    <Table size="small" sx={{ width: 1, "& .MuiTableCell-root": { bgcolor: "white" } }}>
      <TableHead>
        <TableRow>
          {["N°", "Désignation", "Qté", "Unité"].map((col) => (
            <TableCell
              key={col}
              sx={{
                py: 0.5,
                fontWeight: "bold",
                fontSize: "0.75rem",
                borderBottom: (theme) =>
                  `2px solid ${theme.palette.divider}`,
              }}
            >
              {col}
            </TableCell>
          ))}
        </TableRow>
      </TableHead>
      <TableBody>
        {articles.map((article) => (
          <TableRow key={article.num} hover>
            <TableCell
              sx={{
                py: 0.5,
                fontSize: "0.75rem",
                color: "text.secondary",
                width: 32,
              }}
            >
              {article.num}
            </TableCell>
            <TableCell sx={{ py: 0.5, fontSize: "0.75rem" }}>
              {article.label}
            </TableCell>
            <TableCell
              sx={{
                py: 0.5,
                fontSize: "0.75rem",
                textAlign: "right",
                width: 64,
              }}
            >
              {article.qty}
            </TableCell>
            <TableCell
              sx={{
                py: 0.5,
                fontSize: "0.75rem",
                color: "text.secondary",
                width: 48,
              }}
            >
              {article.unit}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
