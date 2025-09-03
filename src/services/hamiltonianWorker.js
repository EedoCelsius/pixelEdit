import { solve } from './hamiltonian.js';

try {
  const { parentPort, workerData } = await import('node:worker_threads');
  const result = await solve(workerData.input, { ...workerData.opts, worker: true });
  parentPort.postMessage(result);
} catch {
  self.onmessage = async (e) => {
    const { input, opts } = e.data;
    const result = await solve(input, { ...opts, worker: true });
    self.postMessage(result);
  };
}
