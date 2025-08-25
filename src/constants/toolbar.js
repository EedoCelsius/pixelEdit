import stageIcons from '../image/stage_toolbar';

export const SINGLE_SELECTION_TOOLS = [
  { type: 'draw', name: 'Draw', icon: stageIcons.draw },
  { type: 'erase', name: 'Erase', icon: stageIcons.erase },
  { type: 'cut', name: 'Cut', icon: stageIcons.cut },
];

export const MULTI_SELECTION_TOOLS = [
  { type: 'select', name: 'Select', icon: stageIcons.select },
  { type: 'globalErase', name: 'Global Erase', icon: stageIcons.globalErase },
];
