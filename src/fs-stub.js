// Stub for Node.js 'fs' module. @ts-evtx/core imports fs but only uses it in
// EvtxFile.open() / openSync() factory methods. We bypass those by calling the
// constructor directly with a Uint8Array, so these stubs are never invoked.
export const promises = {
  readFile: () => { throw new Error('fs.promises.readFile not available in browser') },
  writeFile: () => { throw new Error('fs.promises.writeFile not available in browser') },
}
export function readFileSync() { throw new Error('fs.readFileSync not available in browser') }
export function writeFileSync() { throw new Error('fs.writeFileSync not available in browser') }
export function existsSync() { return false }
const fs = { promises, readFileSync, writeFileSync, existsSync }
export default fs
