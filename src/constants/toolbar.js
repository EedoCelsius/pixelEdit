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

// Mapping of keyboard modifiers to alternative tools. Each entry is
// evaluated in order and only applied when the modifier key is pressed.
//
// - `map` is a dictionary where the current tool maps to the alternate
//   tool when the modifier is active.
// - `default` can be used to specify a tool to use when there is no
//   mapping for the current tool.
//
// This allows the tool selection service to work without hard‑coding
// knowledge of all tools.
export const TOOL_MODIFIERS = [
  { key: 'Shift', map: { default: 'select' } },
  {
    key: 'Control',
    map: { draw: 'erase', erase: 'draw', select: 'globalErase', globalErase: 'select' }
  },
  {
    key: 'Meta',
    map: { draw: 'erase', erase: 'draw', select: 'globalErase', globalErase: 'select' }
  }
];
