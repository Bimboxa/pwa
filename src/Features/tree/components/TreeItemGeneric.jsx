import * as React from "react";

import { Typography, IconButton } from "@mui/material";
import { MoreHoriz as More } from "@mui/icons-material";

import { useTreeItem } from "@mui/x-tree-view/useTreeItem";
import useIsMobile from "Features/layout/hooks/useIsMobile";

import {
  TreeItemCheckbox,
  TreeItemContent,
  TreeItemIconContainer,
  TreeItemLabel,
  TreeItemRoot,
  TreeItemGroupTransition,
} from "@mui/x-tree-view/TreeItem";
import { TreeItemIcon } from "@mui/x-tree-view/TreeItemIcon";
import { TreeItemProvider } from "@mui/x-tree-view/TreeItemProvider";
import { TreeItemDragAndDropOverlay } from "@mui/x-tree-view/TreeItemDragAndDropOverlay";
import { TreeItemLabelInput } from "@mui/x-tree-view/TreeItemLabelInput";

const TreeItemGeneric = React.forwardRef(function CustomTreeItem(
  { id, itemId, label, disabled, children, onMoreClick, count },
  ref
) {
  // data

  const isMobile = useIsMobile();

  // helpers - height

  //const height = isMobile ? "40px" : "30px";

  // helpers - other
  const {
    getContextProviderProps,
    getRootProps,
    getContentProps,
    getIconContainerProps,
    getCheckboxProps,
    getLabelProps,
    getLabelInputProps,
    getGroupTransitionProps,
    getDragAndDropOverlayProps,
    status,
  } = useTreeItem({ id, itemId, children, label, disabled, rootRef: ref });

  const hasChildren = Array.isArray(children) && children.length > 0;

  return (
    <TreeItemProvider {...getContextProviderProps()}>
      <TreeItemRoot {...getRootProps()}>
        <TreeItemContent {...getContentProps()}>
          <TreeItemIconContainer {...getIconContainerProps()}>
            <TreeItemIcon status={status} />
          </TreeItemIconContainer>
          <TreeItemCheckbox {...getCheckboxProps()} />
          <Typography
            sx={{ flexGrow: 1 }}
            color={hasChildren ? "text.secondary" : "text.primary"}
          >
            {label}
          </Typography>
          {status.selected && onMoreClick && (
            <IconButton
              size="small"
              edge="end"
              onClick={(e) => {
                e.stopPropagation();
                onMoreClick(e, itemId);
              }}
            >
              <More fontSize={isMobile ? "medium" : "small"} />
            </IconButton>
          )}

          <TreeItemDragAndDropOverlay {...getDragAndDropOverlayProps()} />
        </TreeItemContent>
        {children && <TreeItemGroupTransition {...getGroupTransitionProps()} />}
      </TreeItemRoot>
    </TreeItemProvider>
  );
});

export default TreeItemGeneric;
