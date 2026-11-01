import { THEME_INIT_SCRIPT } from "./theme";
import { VIEWS_PANEL_INIT_SCRIPT } from "./views-panel";

/** Alle scripts voor <head>, vóór de eerste weergave; los van elkaar uitgevoerd. */
export const HEAD_INIT_SCRIPT = [THEME_INIT_SCRIPT, VIEWS_PANEL_INIT_SCRIPT].join(";\n");
