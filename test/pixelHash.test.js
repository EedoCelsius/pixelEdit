import test from 'node:test';
import assert from 'node:assert';
import { createPinia, setActivePinia } from 'pinia';
const MAX_DIMENSION = 128;
const coordToIndex = (x, y) => x + MAX_DIMENSION * y;

// simple localStorage stub
globalThis.localStorage = {
  getItem: () => null,
  setItem: () => {},
};

const { usePixelStore } = await import('../src/stores/pixels.js');

test('swapping layer pixels changes hash', () => {
  setActivePinia(createPinia());
  const storeA = usePixelStore();
  const l1 = 1, l2 = 2;
  const p1 = coordToIndex(0, 0);
  const p2 = coordToIndex(1, 0);
  const p3 = coordToIndex(0, 1);
  const p4 = coordToIndex(1, 1);
  storeA.set(l1, [p1, p2], 'horizontal');
  storeA.set(l2, [p3, p4], 'vertical');
  const hashA = storeA._hash.all;

  setActivePinia(createPinia());
  const storeB = usePixelStore();
  storeB.set(l1, [p3, p4], 'horizontal');
  storeB.set(l2, [p1, p2], 'vertical');
  const hashB = storeB._hash.all;

  assert.notStrictEqual(hashA, hashB);
});

test('changing pixel direction updates hash', () => {
  setActivePinia(createPinia());
  const store = usePixelStore();
  const layer = 1;
  const px = coordToIndex(0, 0);
  store.set(layer, [px], 'horizontal');
  const hash1 = store._hash.all;
  store.setDirection(layer, px, 'vertical');
  const hash2 = store._hash.all;
  assert.notStrictEqual(hash1, hash2);
});
