import { useRef, useState, useEffect, useCallback, createContext, useContext } from "react";
import { Popper, ClickAwayListener, Box, Paper, IconButton } from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import DragIndicatorIcon from "@mui/icons-material/DragIndicator";

// --- 1. CRÉATION DU CONTEXTE ---
const PopperDragContext = createContext(null);

// --- 2. COMPOSANT ENFANT POUR LE HANDLE ---
// C'est ce composant que vous utiliserez à l'intérieur de vos children
export function PopperDragHandle({ children, sx, ...props }) {
  const startDrag = useContext(PopperDragContext);

  if (!startDrag) {
    console.warn("PopperDragHandle doit être utilisé à l'intérieur d'un PopperBox");
    return <>{children}</>;
  }

  return (
    <Box
      onMouseDown={startDrag}
      sx={{
        cursor: "grab",
        "&:active": { cursor: "grabbing" },
        // On fusionne les styles passés en props
        ...sx
      }}
      {...props}
    >
      {children}
    </Box>
  );
}

// --- 3. LE COMPOSANT PRINCIPAL ---
export default function PopperBox({
  anchorPosition,
  children,
  open,
  onClose,
  disableClickAway = false,
  addHeader, // Optionnel maintenant
  anchorPlacement = "topLeft"
}) {
  // --- Gestion du Virtual Ref ---
  function generateBBCR(x, y) {
    return () => ({
      width: 0, height: 0, top: y, right: x, bottom: y, left: x,
    });
  }
  const virtualElementRef = useRef({ getBoundingClientRect: generateBBCR });

  virtualElementRef.current.getBoundingClientRect = generateBBCR(
    anchorPosition?.x,
    anchorPosition?.y
  );

  // --- Logique de Drag n Drop ---
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const isDragging = useRef(false);
  const dragStartPos = useRef({ x: 0, y: 0 });
  const startOffset = useRef({ x: 0, y: 0 });

  useEffect(() => {
    if (open) {
      setPosition({ x: 0, y: 0 });
    }
  }, [open]);

  // Cette fonction est maintenant passée via le Context
  const handleMouseDown = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation(); // Évite les conflits si imbriqué

    isDragging.current = true;
    dragStartPos.current = { x: e.clientX, y: e.clientY };

    // On utilise la valeur courante de position via le state closure
    // Note: Pour une fonction parfaitement stable, on utiliserait une ref pour position,
    // mais ici c'est suffisant.
    startOffset.current = { x: position.x, y: position.y };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, [position]);

  const handleMouseMove = useCallback((e) => {
    if (!isDragging.current) return;
    const dx = e.clientX - dragStartPos.current.x;
    const dy = e.clientY - dragStartPos.current.y;
    setPosition({
      x: startOffset.current.x + dx,
      y: startOffset.current.y + dy,
    });
  }, []);

  const handleMouseUp = useCallback(() => {
    isDragging.current = false;
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', handleMouseUp);
  }, [handleMouseMove]);

  useEffect(() => {
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [handleMouseMove, handleMouseUp]);

  const muiPlacement = anchorPlacement === "bottomMiddle" ? "top" : "bottom-start";

  function handleClose(e) {
    if (onClose) onClose();
  }

  return (
    <>
      {open && (
        <Box>
          <ClickAwayListener onClickAway={(e) => (disableClickAway ? null : handleClose(e))}>
            <Popper
              open={open}
              anchorEl={virtualElementRef.current}
              placement={muiPlacement}
              modifiers={[
                { name: "arrow", enabled: true },
                { name: "offset", options: { offset: [0, 10] } },
                { name: "preventOverflow", enabled: true, options: { rootBoundary: "viewport", padding: 8, altAxis: true } },
              ]}
            >
              <Paper
                elevation={3}
                sx={{
                  maxWidth: '100vw',
                  overflow: 'visible',
                  position: 'relative',
                  transform: `translate(${position.x}px, ${position.y}px)`,
                  transition: isDragging.current ? 'none' : 'transform 0.1s ease-out',
                }}
              >
                {/* --- 4. PROVIDER : On expose la fonction de drag --- */}
                <PopperDragContext.Provider value={handleMouseDown}>

                  {/* Optionnel : Ancien Header si besoin */}
                  {addHeader && (
                    <Box
                      onMouseDown={handleMouseDown}
                      sx={{ display: "flex", justifyContent: "space-between", bgcolor: "grey.100", borderBottom: 1, borderColor: "divider", p: 0.5, cursor: "move" }}
                    >
                      <Box sx={{ pl: 0.5 }}><DragIndicatorIcon fontSize="small" sx={{ color: "text.secondary" }} /></Box>
                      <IconButton size="small" onClick={handleClose} onMouseDown={(e) => e.stopPropagation()}><CloseIcon fontSize="small" /></IconButton>
                    </Box>
                  )}

                  {/* Les enfants ont maintenant accès au contexte */}
                  {children}

                </PopperDragContext.Provider>
              </Paper>
            </Popper>
          </ClickAwayListener>
        </Box>
      )}
    </>
  );
}