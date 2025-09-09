import test from 'node:test';
import assert from 'node:assert';
import { createPinia, setActivePinia } from 'pinia';
import { useNodeStore } from '../src/stores/nodes.js';

test('store hash differs when swapping names vs colors', () => {
  setActivePinia(createPinia());
  const nodes = useNodeStore();
  const idA = nodes.createLayer({ name: 'A', color: 0x11223344 });
  const idB = nodes.createLayer({ name: 'B', color: 0x55667788 });
  const baseline = nodes.serialize();
  const baselineHash = nodes._hash.all;

  nodes.setName(idA, 'B');
  nodes.setName(idB, 'A');
  const nameHash = nodes._hash.all;
  assert.notStrictEqual(nameHash, baselineHash);

  nodes.applySerialized(baseline);
  assert.strictEqual(nodes._hash.all, baselineHash);
  const colorA = nodes.color(idA);
  const colorB = nodes.color(idB);
  nodes.setColor(idA, colorB);
  nodes.setColor(idB, colorA);
  const colorHash = nodes._hash.all;
  assert.notStrictEqual(colorHash, baselineHash);
  assert.notStrictEqual(nameHash, colorHash);
});
