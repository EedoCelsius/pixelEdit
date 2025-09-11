import test from 'node:test';
import assert from 'node:assert';
import { webcrypto as crypto } from 'node:crypto';
if (!globalThis.crypto) globalThis.crypto = crypto;

import { createPinia, setActivePinia } from 'pinia';

// simple localStorage stub
globalThis.localStorage = { getItem: () => null, setItem: () => {} };

test('cut operation preserves pixel orientation', async () => {
  const { coordToIndex } = await import('../src/utils/pixels.js');
  const { usePixelStore, OT } = await import('../src/stores/pixels.js');
  const { useNodeStore } = await import('../src/stores/nodes.js');
  const { useNodeTreeStore } = await import('../src/stores/nodeTree.js');

  setActivePinia(createPinia());
  const pixelStore = usePixelStore();
  const nodeStore = useNodeStore();
  const nodeTree = useNodeTreeStore();

  const sourceId = nodeStore.addLayer({ name: 'src' });
  pixelStore.addLayer(sourceId);
  const px = coordToIndex(0, 0);
  pixelStore.add(sourceId, [px], OT.VERTICAL);
  nodeTree.insert([sourceId]);

  const sourcePx = pixelStore.get(sourceId);
  const orientationMap = {};
  for (const p of [px]) orientationMap[p] = sourcePx.get(p);
  pixelStore.remove(sourceId, [px]);
  const cutId = nodeStore.addLayer({ name: 'cut' });
  pixelStore.addLayer(cutId);
  pixelStore.update(cutId, orientationMap);

  assert.strictEqual(pixelStore.orientationOf(sourceId, px), undefined);
  assert.strictEqual(pixelStore.orientationOf(cutId, px), OT.VERTICAL);
});
