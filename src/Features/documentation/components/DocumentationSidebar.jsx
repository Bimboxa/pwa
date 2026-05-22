import {useState} from "react";

import {Link as RouterLink, useLocation} from "react-router-dom";

import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import {Box, Collapse, IconButton, List, ListItemButton, ListItemText, Typography} from "@mui/material";

import {DOCUMENTATION_ROOT} from "../constants/documentationRoutes";

function DocItem({id, title, currentPageId}) {
  const selected = currentPageId === id;
  return (
    <ListItemButton
      component={RouterLink}
      to={`${DOCUMENTATION_ROOT}/${id}`}
      selected={selected}
      sx={{
        borderRadius: 1,
        mx: 1,
        my: 0.25,
        "&.Mui-selected": {bgcolor: "action.selected"},
      }}
    >
      <ListItemText
        primary={title}
        primaryTypographyProps={{
          fontSize: 14,
          fontWeight: selected ? 600 : 400,
        }}
      />
    </ListItemButton>
  );
}

function CategoryItem({label, items, currentPageId}) {
  const containsCurrent = items.some(
    (it) => it.type === "doc" && it.id === currentPageId
  );
  const [open, setOpen] = useState(containsCurrent || true);

  return (
    <Box sx={{mb: 0.5}}>
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          px: 2,
          pt: 1.5,
          pb: 0.5,
        }}
      >
        <Typography
          variant="overline"
          sx={{color: "text.secondary", fontWeight: 600, letterSpacing: 0.5}}
        >
          {label}
        </Typography>
        <IconButton size="small" onClick={() => setOpen((v) => !v)}>
          {open ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
        </IconButton>
      </Box>
      <Collapse in={open} timeout="auto" unmountOnExit>
        <List dense disablePadding>
          {items.map((item, i) => renderItem(item, i, currentPageId))}
        </List>
      </Collapse>
    </Box>
  );
}

function renderItem(item, i, currentPageId) {
  if (item.type === "doc") {
    return (
      <DocItem
        key={item.id ?? i}
        id={item.id}
        title={item.title ?? item.id}
        currentPageId={currentPageId}
      />
    );
  }
  if (item.type === "category") {
    return (
      <CategoryItem
        key={item.label ?? i}
        label={item.label}
        items={item.items ?? []}
        currentPageId={currentPageId}
      />
    );
  }
  return null;
}

export default function DocumentationSidebar({sidebar, currentPageId}) {
  const location = useLocation();

  return (
    <Box
      component="nav"
      sx={{
        width: 280,
        minWidth: 280,
        borderRight: (t) => `1px solid ${t.palette.divider}`,
        overflowY: "auto",
        bgcolor: "background.default",
      }}
    >
      <Box sx={{px: 2, pt: 2, pb: 1}}>
        <Typography
          component={RouterLink}
          to={DOCUMENTATION_ROOT}
          variant="subtitle1"
          sx={{
            fontWeight: 700,
            textDecoration: "none",
            color: "text.primary",
          }}
          state={{from: location.pathname}}
        >
          Documentation
        </Typography>
      </Box>
      <List dense disablePadding>
        {(sidebar?.items ?? []).map((item, i) =>
          renderItem(item, i, currentPageId)
        )}
      </List>
    </Box>
  );
}
