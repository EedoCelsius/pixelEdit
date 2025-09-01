import { instantiate } from '@assemblyscript/loader';

// Load wasm module at module initialization time using a relative path
const wasmModule = await instantiate(fetch('hamiltonian.wasm'));
const {
  traverseWithStart: wasmTraverseWithStart,
  traverseWithStartEnd: wasmTraverseWithStartEnd,
  traverseFree: wasmTraverseFree,
  __newArray,
  __getArray,
  __getInt32Array,
  __pin,
  __unpin,
  Int32Array_ID,
} = wasmModule.exports;

function unwrap(ptr) {
  if (!ptr) return [];
  return __getArray(ptr).map((p) => __getInt32Array(p));
}

export const useHamiltonianService = () => {
  return {
    traverseWithStart(pixels, start) {
      const pPtr = __pin(__newArray(Int32Array_ID, pixels));
      const rPtr = wasmTraverseWithStart(pPtr, start);
      const result = unwrap(rPtr);
      __unpin(pPtr);
      __unpin(rPtr);
      return result;
    },
    traverseWithStartEnd(pixels, start, end) {
      const pPtr = __pin(__newArray(Int32Array_ID, pixels));
      const rPtr = wasmTraverseWithStartEnd(pPtr, start, end);
      const result = unwrap(rPtr);
      __unpin(pPtr);
      __unpin(rPtr);
      return result;
    },
    traverseFree(pixels) {
      const pPtr = __pin(__newArray(Int32Array_ID, pixels));
      const rPtr = wasmTraverseFree(pPtr);
      const result = unwrap(rPtr);
      __unpin(pPtr);
      __unpin(rPtr);
      return result;
    },
  };
};
