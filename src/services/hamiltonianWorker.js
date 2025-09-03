import { solve } from './hamiltonian.js';

self.onmessage = async (e) => {
  const { input, opts } = e.data;
  const result = await solve(input, { ...opts, worker: true });
  self.postMessage(result);
};
