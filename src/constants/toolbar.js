import stageIcons from '../image/stage_toolbar';

export const WAND_TOOLS = [
    { type: 'path', name: 'Path', icon: stageIcons.path },
    { type: 'relay', name: 'Relay', icon: stageIcons.relay },
    { type: 'expand', name: 'Expand', icon: stageIcons.expand },
];

export const TOOL_MODIFIERS = {
  'Shift': { default: 'select' },
  'Control': { draw: 'erase', erase: 'draw', select: 'globalErase', globalErase: 'select' },
  'Meta': { draw: 'erase', erase: 'draw', select: 'globalErase', globalErase: 'select' }
};
