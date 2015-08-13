/**
 * Allow gateway-workspace to be booted so that Angular SDK code generation
 * can work with strong-arc.
 *
 * Please note loopback-workspace is dev dependency. Using this code outside
 * of strong-arc will fail.
 */
var boot = require('loopback-boot');
var app = require('loopback-workspace');
boot(app, __dirname);

module.exports = app;

if (require.main === module) {
  app.start();
}

