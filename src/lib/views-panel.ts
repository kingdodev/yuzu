/**
 * Het weergavenpaneel (Te doen, Mijn tickets, shops, labels) naast een open
 * ticket: standaard verborgen, met een knop te tonen. De keuze staat per
 * browser in localStorage en als data-views op <html>, zodat de CSS hem
 * meteen toepast, zonder flikkeren.
 */
export const VIEWS_PANEL_STORAGE_KEY = "yuzu-views-panel";
export const VIEWS_PANEL_ATTR = "data-views";

/** Draait in <head>, samen met het thema-script. */
export const VIEWS_PANEL_INIT_SCRIPT = `(function(){try{if(localStorage.getItem(${JSON.stringify(
  VIEWS_PANEL_STORAGE_KEY,
)})==="open")document.documentElement.setAttribute(${JSON.stringify(VIEWS_PANEL_ATTR)},"open")}catch(e){}})()`;
