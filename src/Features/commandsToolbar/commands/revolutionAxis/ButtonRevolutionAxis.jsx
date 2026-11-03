import CommandButton from "../../components/CommandButton";

// Toolbar button of « Axe de révolution »: draws an axis (command.run) — the
// Button only words the tooltip per editor. Posing an existing axis on a
// vertical base map is the « Axe sur plan de coupe » command
// (PLACE_REVOLUTION_AXIS).
export default function ButtonRevolutionAxis({
  command,
  ctx,
  deps,
  state,
  hotkeyLabel,
}) {
  // strings

  const drawS = "Dessiner un axe : centre, puis rayon et direction";
  const draw3dS =
    "Dessiner un axe sur un plan horizontal : centre, puis rayon et direction";

  // helpers

  const label = ctx.isThreedEditor ? draw3dS : drawS;

  // handlers

  function handleClick() {
    command.run(ctx, deps);
  }

  // render

  return (
    <CommandButton
      commandKey={command.key}
      label={`${command.label} — ${label}`}
      Icon={command.Icon}
      hotkeyLabel={hotkeyLabel}
      state={state}
      onClick={handleClick}
    />
  );
}
