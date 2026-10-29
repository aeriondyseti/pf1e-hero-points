// Localization and DialogV2 helpers.
import { MODULE_ID } from "./constants";

export const t = (key: string, data?: Record<string, unknown>): string =>
  data ? game.i18n.format(`${MODULE_ID}.${key}`, data) : game.i18n.localize(`${MODULE_ID}.${key}`);

export function escapeHtml(text: unknown): string {
  return String(text ?? "").replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

const DialogV2 = () => foundry.applications.api.DialogV2;

/** Ask before spending, unless the player turned the confirmation off. */
export async function confirmSpend(question: string): Promise<boolean> {
  if (!game.settings.get(MODULE_ID, "confirmSpend")) return true;
  const ok = await DialogV2().confirm({
    window: { title: t("Confirm.Title"), icon: "fa-solid fa-star" },
    content: `<p>${escapeHtml(question)}</p>`,
    rejectClose: false,
    modal: true,
  });
  return ok === true;
}

/** One button per choice; resolves to the chosen entry, or undefined if the dialog was closed. */
export async function choose<T>(title: string, choices: T[], label: (choice: T) => string): Promise<T | undefined> {
  if (choices.length <= 1) return choices[0];
  const picked = await DialogV2().wait({
    window: { title, icon: "fa-solid fa-star" },
    content: "",
    buttons: choices.map((choice, i) => ({ action: String(i), label: escapeHtml(label(choice)) })),
    rejectClose: false,
    modal: true,
  });
  return typeof picked === "string" ? choices[Number(picked)] : undefined;
}
