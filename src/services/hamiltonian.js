import { instantiate } from '@assemblyscript/loader';
import wasmUrl from '../wasm/hamiltonian.wasm?url';

const { exports: wasm } = await instantiate(fetch(wasmUrl));

function parsePaths(flat) {
  const paths = [];
  let idx = 0;
  const count = flat[idx++];
  for (let i = 0; i < count; i++) {
    const len = flat[idx++];
    const path = new Array(len);
    for (let j = 0; j < len; j++) path[j] = flat[idx++];
    paths.push(path);
  }
  return paths;
}

export const useHamiltonianService = () => {
  function traverseWithStart(pixels, start) {
    const { traverseWithStart, __newArray, __getInt32Array, I32ARRAY_ID } = wasm;
    const ptr = __newArray(I32ARRAY_ID, pixels);
    const resPtr = traverseWithStart(ptr, start);
    const flat = __getInt32Array(resPtr);
    return parsePaths(flat);
  }

  function traverseWithStartEnd(pixels, start, end) {
    const { traverseWithStartEnd, __newArray, __getInt32Array, I32ARRAY_ID } = wasm;
    const ptr = __newArray(I32ARRAY_ID, pixels);
    const resPtr = traverseWithStartEnd(ptr, start, end);
    const flat = __getInt32Array(resPtr);
    return parsePaths(flat);
  }

  function traverseFree(pixels) {
    const { traverseFree, __newArray, __getInt32Array, I32ARRAY_ID } = wasm;
    const ptr = __newArray(I32ARRAY_ID, pixels);
    const resPtr = traverseFree(ptr);
    const flat = __getInt32Array(resPtr);
    return parsePaths(flat);
  }

  return {
    traverseWithStart,
    traverseWithStartEnd,
    traverseFree,
  };
};
