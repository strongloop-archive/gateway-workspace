// Copyright IBM Corp. 2015. All Rights Reserved.
// Node module: gateway-workspace
// This file is licensed under the MIT License.
// License text available at https://opensource.org/licenses/MIT

/*!
 * Expose the module as a LoopBack component
 * @type {exports|module.exports}
 */
var boot = require('loopback-boot');

module.exports = function(app, options) {
  boot(app, __dirname);
};
