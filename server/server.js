var loopback = require('loopback');
var boot = require('loopback-boot');
var app = module.exports = loopback();
var path = require('path');

boot(app, __dirname);

require('./connector');

app.emit('ready');
