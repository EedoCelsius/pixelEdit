import test from 'node:test';
import { webcrypto as crypto } from 'node:crypto';
if (!globalThis.crypto) globalThis.crypto = crypto;

import assert from 'node:assert';
import { createPinia, setActivePinia } from 'pinia';
const MAX_DIMENSION = 128;
const coordToIndex = (x, y) => x + MAX_DIMENSION * y;

// simple localStorage stub
globalThis.localStorage = {
  getItem: () => null,
  setItem: () => {},
};

const { usePixelStore, OT } = await import('../src/stores/pixels.js');

test('swapping layer pixels changes hash', () => {
  setActivePinia(createPinia());
  const storeA = usePixelStore();
  const l1 = 1, l2 = 2;
  storeA.addLayer([l1, l2]);
  const p1 = coordToIndex(0, 0);
  const p2 = coordToIndex(1, 0);
  const p3 = coordToIndex(0, 1);
  const p4 = coordToIndex(1, 1);
  storeA.add(l1, [p1, p2], OT.HORIZONTAL);
  storeA.add(l2, [p3, p4], OT.VERTICAL);
  const hashA = storeA._hash.all;

  setActivePinia(createPinia());
  const storeB = usePixelStore();
  storeB.addLayer([l1, l2]);
  storeB.add(l1, [p3, p4], OT.HORIZONTAL);
  storeB.add(l2, [p1, p2], OT.VERTICAL);
  const hashB = storeB._hash.all;

  assert.notStrictEqual(hashA, hashB);
});

test('changing pixel orientation updates hash', () => {
  setActivePinia(createPinia());
  const store = usePixelStore();
  const layer = 1;
  store.addLayer(layer);
  const px = coordToIndex(0, 0);
  store.add(layer, [px], OT.HORIZONTAL);
  const hash1 = store._hash.all;
  store.add(layer, [px], OT.VERTICAL);
  const hash2 = store._hash.all;
  assert.notStrictEqual(hash1, hash2);
});

test('checkerboard uses chosen orientations', () => {
  setActivePinia(createPinia());
  const store = usePixelStore();
  const layer = 1;
  store.addLayer(layer);
  store.setDefaultOrientation('checkerboard');
  store.setCheckerboardOrientations(OT.DOWNSLOPE, OT.UPSLOPE);
  const px1 = coordToIndex(0, 0);
  const px2 = coordToIndex(1, 0);
  store.add(layer, [px1, px2]);
  assert.strictEqual(store.orientationOf(layer, px1), OT.DOWNSLOPE);
  assert.strictEqual(store.orientationOf(layer, px2), OT.UPSLOPE);
});

test('update applies per-pixel orientations and OT.DEFAULT', () => {
  setActivePinia(createPinia());
  const store = usePixelStore();
  const layer = 1;
  store.addLayer(layer);
  store.setDefaultOrientation(OT.VERTICAL);
  const p1 = coordToIndex(0, 0);
  const p2 = coordToIndex(1, 0);
  store.update(layer, { [p1]: OT.HORIZONTAL, [p2]: OT.DEFAULT });
  assert.strictEqual(store.orientationOf(layer, p1), OT.HORIZONTAL);
  assert.strictEqual(store.orientationOf(layer, p2), OT.VERTICAL);
});

test('update with 0 removes pixel', () => {
  setActivePinia(createPinia());
  const store = usePixelStore();
  const layer = 1;
  store.addLayer(layer);
  const px = coordToIndex(0, 0);
  store.add(layer, [px], OT.HORIZONTAL);
  assert.strictEqual(store.orientationOf(layer, px), OT.HORIZONTAL);
  store.update(layer, { [px]: 0 });
  assert.strictEqual(store.orientationOf(layer, px), undefined);
});
