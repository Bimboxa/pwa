import { useRef } from "react";

import { Box } from "@mui/material";

import TitleBlockSvg from "./TitleBlockSvg";
import TitleBlockLogoPlaceholder from "./TitleBlockLogoPlaceholder";

import getTitleBlockBindTarget, {
  readDraftValue,
  writeDraftValue,
} from "../utils/getTitleBlockBindTarget";
import {
  PAD_VALUE_LEFT,
  PAD_VALUE_RIGHT,
  PAD_LABEL_RIGHT,
} from "../utils/computeTitleBlockLayout";

import theme from "Styles/theme";

// Title block with an <input> in every editable value cell. Static drawing
// (frame, grid, labels, logo, read-only cells) is delegated to TitleBlockSvg;
// the editable cells are hidden there and re-rendered as <foreignObject>
// inputs with the same font metrics so the dialog stays WYSIWYG.
// `draft` = { values, portfolioName, pageTitle }, `bindings` = the live
// bindings passed to computeTitleBlockLayout (used for placeholders).
export default function TitleBlockEditableSvg({
  layoutData,
  style = {},
  logoUrl,
  draft,
  bindings,
  onDraftChange,
  onLogoFile,
  onLogoDelete,
}) {
  const logoInputRef = useRef(null);

  // helpers

  const fontFamily = style.fontFamily || "Helvetica, Arial, sans-serif";
  const valueColor = style.valueColor || "#333";
  const accent = theme.palette.viewers.portfolio;
  const logoSlot = layoutData.imageSlots[0];

  const isEditable = (t) =>
    t.kind === "value" && Boolean(getTitleBlockBindTarget(t.bind));

  // handlers

  function handleKeyDown(e) {
    if (e.key === "Enter") {
      e.preventDefault();
      e.target.blur();
    }
  }

  function handleLogoChange(e) {
    e.stopPropagation();
    const file = e.target.files?.[0];
    if (file) onLogoFile(file);
    if (logoInputRef.current) logoInputRef.current.value = "";
  }

  // render

  return (
    <g>
      <TitleBlockSvg
        layoutData={layoutData}
        style={style}
        logoUrl={logoUrl}
        hideText={isEditable}
      />

      {/* Editable value cells */}
      {layoutData.texts.map((t, i) => {
        if (!isEditable(t)) return null;
        const target = getTitleBlockBindTarget(t.bind);
        const value = readDraftValue(draft, target);
        const placeholder = t.fallbackBind ? bindings?.[t.fallbackBind] : "";
        return (
          <foreignObject
            key={i}
            x={t.x}
            y={t.y}
            width={t.width}
            height={t.height}
          >
            <Box
              component="input"
              type="text"
              value={value}
              placeholder={placeholder || ""}
              onChange={(e) =>
                onDraftChange(writeDraftValue(draft, target, e.target.value))
              }
              onKeyDown={handleKeyDown}
              sx={{
                display: "block",
                width: "100%",
                height: "100%",
                boxSizing: "border-box",
                m: 0,
                pt: 0,
                pb: 0,
                pl: `${PAD_VALUE_LEFT}px`,
                pr: `${t.align === "right" ? PAD_LABEL_RIGHT : PAD_VALUE_RIGHT}px`,
                border: "none",
                outline: `1px dashed ${accent}55`,
                outlineOffset: "-2px",
                borderRadius: "2px",
                bgcolor: "transparent",
                fontFamily,
                fontSize: `${t.fontSize}px`,
                fontWeight: t.bold ? 700 : 400,
                color: valueColor,
                textAlign: t.align || "left",
                cursor: "text",
                "&::placeholder": { color: "#999", opacity: 1 },
                "&:hover": { bgcolor: `${accent}0d` },
                "&:focus": {
                  outline: `1.5px solid ${accent}`,
                  bgcolor: `${accent}14`,
                },
              }}
            />
          </foreignObject>
        );
      })}

      {/* Logo: replace / delete over the current image */}
      {logoUrl && logoSlot && (
        <foreignObject
          x={logoSlot.x}
          y={logoSlot.y}
          width={logoSlot.width}
          height={logoSlot.height}
        >
          <Box
            sx={{
              position: "relative",
              width: "100%",
              height: "100%",
              "&:hover .logo-actions": { opacity: 1 },
            }}
          >
            <Box
              component="label"
              title="Changer le logo"
              sx={{
                display: "block",
                width: "100%",
                height: "100%",
                cursor: "pointer",
                borderRadius: "2px",
                "&:hover": { outline: `1.5px dashed ${accent}` },
              }}
            >
              <input
                ref={logoInputRef}
                type="file"
                accept="image/*"
                hidden
                onChange={handleLogoChange}
              />
            </Box>
            <Box
              className="logo-actions"
              component="button"
              type="button"
              title="Supprimer le logo"
              onClick={onLogoDelete}
              sx={{
                position: "absolute",
                top: 2,
                right: 2,
                width: 14,
                height: 14,
                p: 0,
                border: "none",
                borderRadius: "50%",
                bgcolor: "rgba(0,0,0,0.55)",
                color: "white",
                fontSize: "10px",
                lineHeight: "14px",
                cursor: "pointer",
                opacity: 0,
                transition: "opacity 0.15s",
              }}
            >
              ×
            </Box>
          </Box>
        </foreignObject>
      )}
      {!logoUrl && (
        <TitleBlockLogoPlaceholder
          slot={logoSlot}
          fontFamily={fontFamily}
          onFile={onLogoFile}
        />
      )}
    </g>
  );
}
