// Stub for @ts-evtx/messages — this package requires Node.js + SQLite and is
// not available in the browser. The dynamic import inside @ts-evtx/core's query.js
// is wrapped in try/catch, so throwing here lets the parse fall back gracefully.
export class SmartManagedMessageProvider {
  constructor() {
    throw new Error('@ts-evtx/messages is not available in the browser context.')
  }
}

export default {}
