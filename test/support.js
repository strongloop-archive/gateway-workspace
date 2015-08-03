var fs = require('fs-extra');
var loopback = require('loopback');
var boot = require('loopback-boot');
var async = require('async');
var path = require('path');
expect = require('chai').expect;
var debug = require('debug')('workspace:test:support');

workspace = bootWorkspaceWithGateway();

console.log(Object.keys(workspace.models));

SANDBOX = path.resolve(__dirname, 'sandbox/');

// tell the workspace to load files from the sandbox
process.env.WORKSPACE_DIR = SANDBOX;


function bootWorkspaceWithGateway() {
  var app = require('loopback-workspace');

  boot(app, path.join(__dirname, '..', 'server'));
  app.emit('ready');

  return app;
}

givenEmptySandbox = function(cb) {
  fs.remove(SANDBOX, function(err) {
    if(err) return cb(err);
    fs.mkdir(SANDBOX, cb);
  });

  // Remove any cached modules from SANDBOX
  for (var key in require.cache) {
    if (key.slice(0, SANDBOX.length) == SANDBOX)
      delete require.cache[key];
  }
}

resetWorkspace = function(cb) {
  async.each(workspace.models(), function(model, cb) {
    model.destroyAll(cb);
  }, cb);
}

givenEmptyWorkspace = function(cb) {
  var test = this;
  test.serverFacet = 'server';
  resetWorkspace(function(err) {
    if(err) return cb(err);
    givenEmptySandbox(function(err) {
      if(err) return cb(err);
      workspace.models.Facet.create({
        name: test.serverFacet
      }, cb);
    });
  });
}

// Let express know that we are runing from unit-tests
// This way the default error handler does not log
// errors to STDOUT
process.env.NODE_ENV = 'test';
