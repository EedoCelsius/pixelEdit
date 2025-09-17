export const SVG_NAMESPACE = 'http://www.w3.org/2000/svg';

export const SVG_EXPORT_UNITS = ['px', 'pt', 'in', 'mm'];

const hasLocalStorage = typeof localStorage !== 'undefined';
const storedUnit = hasLocalStorage ? localStorage.getItem('settings.svgExportUnit') : null;
const storedPixelSize = hasLocalStorage ? Number(localStorage.getItem('settings.svgExportPixelSize')) : NaN;

const defaultUnit = SVG_EXPORT_UNITS.includes(storedUnit) ? storedUnit : 'px';
const defaultPixelSize = Number.isFinite(storedPixelSize) && storedPixelSize > 0 ? storedPixelSize : 1;

export const SVG_EXPORT_CONFIG = {
  UNIT: defaultUnit,
  PIXEL_SIZE: defaultPixelSize
};
