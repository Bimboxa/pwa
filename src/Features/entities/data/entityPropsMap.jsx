import {
  Pentagon as ShapeIcon,
  ShoppingCart as Article,
} from "@mui/icons-material";

import theme from "Styles/theme";

const entityPropsMap = {
  SHAPE: {
    titlePlural: "Formes",
    bgcolor: theme.palette.entities.shape,
    icon: <ShapeIcon sx={{color: "inherit"}} />,
  },
  ARTICLE: {
    titlePlural: "Articles",
    bgcolor: theme.palette.entities.article,
    icon: <Article sx={{color: "inherit"}} />,
  },
};

export default entityPropsMap;
