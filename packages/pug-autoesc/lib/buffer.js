const contextDefs = require('./context-defs');
const contextUpdate = require('./context-update');
const escapers = require('./escapers');

let bufferCache = Object.create(null);
let bufferCacheSize = 0;
const bufferCacheSizeLimit = 100;

function Buffer() {
  this.html = '';
  this.context = contextDefs.STATE_HTML_PCDATA;
}
Buffer.prototype.toString = function () {
  if (this.context === contextDefs.STATE_ERROR) {
    return '(Error)';
  }
  return this.html;
};
Buffer.prototype.writeSafe = function (...xs) {
  for (let i = 0, n = xs.length; i < n; ++i) {
    const x = xs[i];
    const str = String(x);
    const contextBefore = this.context;

    let cacheForStr = bufferCache[str];
    if (!cacheForStr) {
      if (bufferCacheSize === bufferCacheSizeLimit) {
        bufferCacheSize = 0;
        bufferCache = Object.create(null);
      }
      bufferCache[str] = cacheForStr = Object.create(null);
      ++bufferCacheSize;
    }

    let contextAfter = cacheForStr[contextBefore];
    if (contextAfter === undefined) {
      contextAfter = contextUpdate.processRawText(str, contextBefore);
      cacheForStr[contextBefore] = contextAfter;
    }

    this.context = contextAfter;
    if (contextAfter === contextDefs.STATE_ERROR) {
      throw new Error(
          "Autoescaper reached error state for "
          + JSON.stringify(str) + " from "
          + contextUpdate.contextToString(contextBefore));
    }

    this.html += str;
  }
};
Buffer.prototype.writeUnsafe = function (...xs) {
  for (let i = 0, n = xs.length; i < n; ++i) {
    const x = xs[i];

    const contextBefore = this.context;
    const sanitizerFunctions = {};
    const contextAfter = contextUpdate.computeEscapingModeForSubst(
        contextBefore, sanitizerFunctions);
    const { firstEscMode, secondEscMode } = sanitizerFunctions;
    var sanitizer = escapers.SANITIZER_FOR_ESC_MODE[firstEscMode];
    if (!sanitizer || contextAfter == contextDefs.STATE_ERROR) {
      throw new Error(
          "Interpolation in illegal context "
          + contextUpdate.contextToString(contextBefore));
    }
    var safeContent = sanitizer(x);
    if (secondEscMode !== null) {
      var sanitizer2 = escapers.SANITIZER_FOR_ESC_MODE[secondEscMode];
      safeContent = sanitizer2(safeContent);
    }

    this.html += safeContent;
  }
};

exports.Buffer = Buffer;
