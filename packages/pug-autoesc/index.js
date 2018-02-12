'use strict';

const buffer = require('./lib/buffer');
const escapers = require('./lib/escapers');
const stringify = require('js-stringify');


const compileHooks = {
  initialize: function (buf, runtime) {
    this.buf = buf;
    this.runtime = runtime;

    // Use to collapse adjacent writes to
    // Buffer::writeSafe && Buffer::writeUnsafe.
    this.pendingArgs = [];
    this.pendingBufIndex = NaN;
    this.pendingIsText = null;
    this.pendingIsSafe = null;

    return 'pug_html = (new ' + this.runtime('autoescBuffer') + ')';
  },
  emitCoallescing: function (expr, safe, isText) {
    let bufIndex;
    let argListIndex;
    if (this.pendingIsSafe == safe
        && this.buf.length - 1 === this.pendingBufIndex) {
      // There is an existing call to pug_html.writeXYZ on buf.
      bufIndex = this.pendingBufIndex;
      argListIndex = this.pendingArgs.length;
      if (isText && this.pendingIsText) {
        // Both the last argument and expr are string literals
        let prefix = this.pendingArgs[argListIndex - 1];
        if (prefix.charAt(0) === expr.charAt(0)) {
          // Merge into one string literal.
          // The condition above may be false if stringify uses
          // single quotes in some cases and double quotes in others.
          argListIndex -= 1;
          expr = prefix.substr(0, prefix.length - 1) + expr.substr(1);
        }
      }
    } else {
      this.pendingArgs.length = 0;
      bufIndex = this.buf.length;
      argListIndex = 0;
    }

    const methodName = safe ? 'writeSafe' : 'writeUnsafe';

    this.pendingArgs[argListIndex] = expr;
    this.pendingIsSafe = safe;
    this.pendingIsText = isText;

    this.pendingBufIndex = bufIndex;
    this.buf[bufIndex] = 'pug_html.' + methodName + '('
        + this.pendingArgs.join(', ')
        + ')';
  },
  emitText: function (str) {
    let expr = stringify(str);
    this.emitCoallescing(expr, true, true);
  },
  emitExpr: function (src, trusted, needsEscape) {
    this.emitCoallescing(src, trusted, false);
  },
  attrFilter: function (key) {
    key = key.toLowerCase();
    if (key === 'src' || key === 'href') {
      // TODO: Use URI_ATTR_NAMES in context-update.js
      return 'filterUrl';
    } else if (key.substring(0, 2) == 'on') {
      return '//zSafeHtmlz';
    }
    return null;
  },
  attrMapFilter: function (key) {
    return 'filterAttribs';
  },
  result: function () {
    return 'pug_html.toString()';
  }
};


// TODO: Should this module be split into separate compile time
// and runtime modules?
exports.compileHooks = compileHooks;
exports.Buffer = buffer.Buffer;
exports.filterNormalizeUri = escapers.filterNormalizeUri;
