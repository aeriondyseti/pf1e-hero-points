import { MODULE_ID } from "./constants";
import { DEFAULT_ITEM_NAME, heroPointItem, heroPoints, spend } from "./hero-points";
import { useOnMessage } from "./apply";
import { isArmed, registerBeforeRollHooks, setArmed } from "./before-roll";
import { registerContextMenu } from "./context-menu";
import { rollTargets } from "./targets";

Hooks.once("init", () => {
  game.settings.register(MODULE_ID, "itemName", {
    name: `${MODULE_ID}.Settings.ItemName.Name`,
    hint: `${MODULE_ID}.Settings.ItemName.Hint`,
    scope: "world",
    config: true,
    type: String,
    default: DEFAULT_ITEM_NAME,
  });
  game.settings.register(MODULE_ID, "oncePerRound", {
    name: `${MODULE_ID}.Settings.OncePerRound.Name`,
    hint: `${MODULE_ID}.Settings.OncePerRound.Hint`,
    scope: "world",
    config: true,
    type: Boolean,
    default: true,
  });
  game.settings.register(MODULE_ID, "confirmSpend", {
    name: `${MODULE_ID}.Settings.ConfirmSpend.Name`,
    hint: `${MODULE_ID}.Settings.ConfirmSpend.Hint`,
    scope: "client",
    config: true,
    type: Boolean,
    default: true,
  });

  registerContextMenu();
  registerBeforeRollHooks();
});

Hooks.once("ready", () => {
  const mod = game.modules.get(MODULE_ID);
  if (mod) mod.api = { heroPointItem, heroPoints, spend, isArmed, setArmed, rollTargets, useOnMessage };
});
