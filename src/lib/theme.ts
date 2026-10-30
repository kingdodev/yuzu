/** Weergave: licht, donker, of volgen wat de computer gebruikt. */
export type Theme = "light" | "dark" | "system";

export const THEME_STORAGE_KEY = "yuzu-theme";

/**
 * Draait in <head> vóór de eerste weergave, zodat de gekozen kleuren er
 * meteen staan en er niets flikkert. Bij "system" (of geen keuze) staat er
 * geen data-theme en beslist de CSS op basis van de computerinstelling.
 */
export const THEME_INIT_SCRIPT = `(function(){try{var t=localStorage.getItem(${JSON.stringify(
  THEME_STORAGE_KEY,
)});if(t==="light"||t==="dark")document.documentElement.setAttribute("data-theme",t)}catch(e){}})()`;
