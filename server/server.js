/*!
 * Expose the module as a LoopBack component
 * @type {exports|module.exports}
 */
var boot = require('loopback-boot');

module.exports = function(app, options) {
  boot(app, __dirname);
};