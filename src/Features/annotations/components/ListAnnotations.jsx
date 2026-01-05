import { List, ListItem, Box, Typography } from "@mui/material";
import AnnotationIcon from "./AnnotationIcon";

export default function ListAnnotations({ annotations }) {

    // render

    return <List dense>
        {annotations?.map((annotation) => {
            return <ListItem key={annotation.id} divider>
                <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                    <AnnotationIcon annotation={annotation} size={24} />
                    <Typography variant="body2">{annotation.label}</Typography>
                </Box>

            </ListItem>
        })}
    </List>
}