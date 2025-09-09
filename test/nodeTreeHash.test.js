import test from 'node:test';
import { webcrypto as crypto } from 'node:crypto';
globalThis.crypto = crypto;

import assert from 'node:assert';
import { createPinia, setActivePinia } from 'pinia';
import { useNodeStore } from '../src/stores/nodes.js';
import { useNodeTreeStore } from '../src/stores/nodeTree.js';

test('nodeTree hashing for tree and selection', () => {
  setActivePinia(createPinia());
  const nodes = useNodeStore();
  const tree = useNodeTreeStore();
  const l1 = nodes.addLayer({ name: 'L1' });
  const l2 = nodes.addLayer({ name: 'L2' });
  const g = nodes.addGroup({ name: 'G' });
  tree.append([g]);
  tree.append([l1, l2], g, false);

  const baseHash = tree._hash.tree.hash;

  tree.insert([l1], l2, false);
  const swappedHash = tree._hash.tree.hash;
  assert.notStrictEqual(swappedHash, baseHash);

  tree.insert([l1], l2, true);
  assert.strictEqual(tree._hash.tree.hash, baseHash);

  tree.replaceSelection([l1]);
  assert.strictEqual(tree._hash.selection, l1 | 0);
  tree.addToSelection([l2]);
  assert.strictEqual(tree._hash.selection, (l1 ^ l2) | 0);
  tree.removeFromSelection([l1]);
  assert.strictEqual(tree._hash.selection, l2 | 0);
  tree.clearSelection();
  assert.strictEqual(tree._hash.selection, 0);
});
