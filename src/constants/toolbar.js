import stageIcons from '../image/stage_toolbar';

export const SINGLE_SELECTION_TOOLS = [
  { type: 'draw', name: 'Draw', icon: stageIcons.draw },
  { type: 'erase', name: 'Erase', icon: stageIcons.erase },
  { type: 'cut', name: 'Cut', icon: stageIcons.cut },
  { type: 'top', name: 'To Top', icon: stageIcons.top },
];

export const MULTI_SELECTION_TOOLS = [
  { type: 'select', name: 'Select', icon: stageIcons.select },
  { type: 'globalErase', name: 'Global Erase', icon: stageIcons.globalErase },
  { type: 'path', name: 'Path', icon: stageIcons.path },
];

export const TOOL_MODIFIERS = {
  'Shift': { default: 'select' },
  'Control': { draw: 'erase', erase: 'draw', select: 'globalErase', globalErase: 'select' },
  'Meta': { draw: 'erase', erase: 'draw', select: 'globalErase', globalErase: 'select' }
};
