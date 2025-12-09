import { useRef, useState, useEffect, useCallback } from "react";
import { Popper, ClickAwayListener, Box, Paper, IconButton } from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import DragIndicatorIcon from "@mui/icons-material/DragIndicator";

export default function PopperBox({
  anchorPosition,
  children,
  open,
  onClose,
  disableClickAway = false,
  addHeader
}) {
  // --- 1. Gestion du Virtual Ref (Inchangé) ---
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

  // --- 2. Logique de Drag n Drop Native ---
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const isDragging = useRef(false);
  const dragStartPos = useRef({ x: 0, y: 0 }); // Position de la souris au début du drag
  const startOffset = useRef({ x: 0, y: 0 });  // Position de la fenêtre au début du drag

  // Réinitialiser la position quand la fenêtre s'ouvre (optionnel, selon votre besoin UX)
  useEffect(() => {
    if (open) {
      setPosition({ x: 0, y: 0 });
    }
  }, [open]);

  // Démarre le drag quand on appuie sur le header
  const handleMouseDown = (e) => {
    if (!addHeader) return;

    e.preventDefault(); // Empêche la sélection de texte
    isDragging.current = true;

    // On enregistre où était la souris et où était la fenêtre au moment du clic
    dragStartPos.current = { x: e.clientX, y: e.clientY };
    startOffset.current = { x: position.x, y: position.y };

    // On attache les écouteurs au document pour suivre la souris même si elle sort de la div
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  // Calcul du déplacement
  const handleMouseMove = useCallback((e) => {
    if (!isDragging.current) return;

    const dx = e.clientX - dragStartPos.current.x;
    const dy = e.clientY - dragStartPos.current.y;

    setPosition({
      x: startOffset.current.x + dx,
      y: startOffset.current.y + dy,
    });
  }, []); // Pas de dépendances car on utilise des refs pour les valeurs changeantes

  // Fin du drag
  const handleMouseUp = () => {
    isDragging.current = false;
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', handleMouseUp);
  };

  // Nettoyage de sécurité si le composant est démonté pendant un drag
  useEffect(() => {
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [handleMouseMove]);


  // --- 3. Handlers Close ---
  function handleClose(e) {
    onClose();
  }

  return (
    <>
      {open && (
        <Box>
          <ClickAwayListener onClickAway={(e) => (disableClickAway ? null : handleClose(e))}>
            <Popper
              disablePortal={false}
              open={open}
              // Note: onClose n'est pas une prop standard de Popper, je l'ai retirée ici car gérée par ClickAway
              anchorEl={virtualElementRef.current}
              placement="auto"
              modifiers={[
                { name: "arrow", enabled: true },
                { name: "offset", options: { offset: [0, 10] } },
                {
                  name: "preventOverflow",
                  enabled: true,
                  options: {
                    rootBoundary: "viewport",
                    altAxis: true,
                    altBoundary: true,
                    tether: true,
                    padding: 8,
                  },
                },
              ]}
            >
              {/* Conteneur visuel (Paper) qui reçoit la transformation CSS */}
              <Paper
                elevation={3}
                sx={{
                  maxWidth: '100vw',
                  overflow: 'hidden',
                  // C'est ici que la magie opère : on décale visuellement le contenu
                  transform: `translate(${position.x}px, ${position.y}px)`,
                  transition: isDragging.current ? 'none' : 'transform 0.1s ease-out', // Fluidité optionnelle
                }}
              >

                {/* --- HEADER --- */}
                {addHeader && (
                  <Box
                    onMouseDown={handleMouseDown} // L'événement déclencheur
                    sx={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      bgcolor: "grey.100",
                      borderBottom: 1,
                      borderColor: "divider",
                      p: 0.5,
                      cursor: "move", // Indique que c'est déplaçable
                      userSelect: "none" // Évite de surligner le header en glissant
                    }}
                  >
                    {/* Handle à gauche */}
                    <Box sx={{ display: 'flex', alignItems: 'center', pl: 0.5 }}>
                      <DragIndicatorIcon fontSize="small" sx={{ color: "text.secondary" }} />
                    </Box>

                    {/* Close à droite */}
                    <IconButton
                      size="small"
                      onClick={handleClose}
                      // Important : on empêche le clic de fermer de lancer le drag
                      onMouseDown={(e) => e.stopPropagation()}
                    >
                      <CloseIcon fontSize="small" />
                    </IconButton>
                  </Box>
                )}

                {/* --- CONTENU --- */}
                <Box>
                  {children}
                </Box>
              </Paper>
            </Popper>
          </ClickAwayListener>
        </Box>
      )}
    </>
  );
}