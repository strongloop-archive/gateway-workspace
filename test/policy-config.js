var fs = require('fs-extra');
var loopback = require('loopback');
var boot = require('loopback-boot');
var async = require('async');
var path = require('path');
var expect = require('chai').expect;

var workspace = bootWorkspaceWithGateway();
var SANDBOX = path.resolve(__dirname, 'sandbox/');

// tell the workspace to load files from the sandbox
process.env.WORKSPACE_DIR = SANDBOX;

function bootWorkspaceWithGateway() {
  var app = require('loopback-workspace');

  boot(app, path.join(__dirname, '..', 'server'));
  app.emit('ready');

  return app;
}

var givenEmptySandbox = function(cb) {
  fs.remove(SANDBOX, function(err) {
    if (err) return cb(err);
    fs.mkdir(SANDBOX, cb);
  });

  // Remove any cached modules from SANDBOX
  for (var key in require.cache) {
    if (key.slice(0, SANDBOX.length) == SANDBOX)
      delete require.cache[key];
  }
};

var resetWorkspace = function(cb) {
  async.each(workspace.models(), function(model, cb) {
    model.destroyAll(cb);
  }, cb);
};

var givenEmptyWorkspace = function(cb) {
  var test = this;
  test.serverFacet = 'server';
  resetWorkspace(function(err) {
    if (err) return cb(err);
    givenEmptySandbox(function(err) {
      if (err) return cb(err);
      workspace.models.Facet.create({
        name: test.serverFacet
      }, cb);
    });
  });
};

// Let express know that we are runing from unit-tests
// This way the default error handler does not log
// errors to STDOUT
process.env.NODE_ENV = 'test';

var async = require('async');

describe('Gateway Policies', function() {
  var ConfigFile = workspace.models.ConfigFile;
  var GatewayMap = workspace.models.GatewayMap;
  var Pipeline = workspace.models.Pipeline;
  var Policy = workspace.models.Policy;
  var AuthPolicy = workspace.models.AuthPolicy;

  function createPoliciesAndPipelines(cb) {
    async.parallel([
      function(done) {
        AuthPolicy.create({
          name: 'auth-catalog',
          scopes: ['catalog', 'shopping'],
          phase: 'auth'
        }, done);
      },
      function(done) {
        Policy.create({
          name: 'rate-limiter-per-minute',
          type: 'rateLimiting',
          interval: 60000,
          limit: 1000,
          phase: 'auth:after'
        }, done);
      },
      function(done) {
        Policy.create({
          name: 'proxy-to-catalog',
          type: 'reverseProxy',
          targetURL: 'https://server1.example.com/api/catalog',
          phase: 'final'
        }, done);
      }], function(err, policies) {
      if (err) return cb(err);
      Pipeline.create({
        name: 'default-pipeline'
      }, function(err, pipeline) {
        if (err) return cb(err);
        async.each(policies, function(policy, done) {
          pipeline.policies.add(policy, done);
        }, cb);
      });
    });
  }

  describe('create models for maps/pipelines/policies', function() {
    beforeEach(givenEmptyWorkspace);
    beforeEach(function(done) {
      var serverFacet = this.serverFacet;
      this.configFile = new ConfigFile({
        path: serverFacet + '/policy-config.json'
      });
      async.series([
        createPoliciesAndPipelines,
        function(done) {
          GatewayMap.create({
            name: 'catalog',
            verb: 'GET',
            endpoint: '/api/catalog',
            pipelineId: 'default-pipeline'
          }, done);
        },
        function(done) {
          GatewayMap.create({
            name: 'invoice',
            verb: 'ALL',
            endpoint: '/api/invoices',
            pipelineId: 'default-pipeline'
          }, done);
        }, function(done) {
          GatewayMap.create({
            name: 'order',
            verb: 'ALL',
            endpoint: '/api/orders',
            pipelineId: 'order-pipeline'
          }, done);
        }], done);
    });

    beforeEach(function(done) {
      this.configFile.load(done);
    });

    it('should be able to create multiple maps', function(done) {
      GatewayMap.find(function(err, defs) {
        if (err) return done(err);
        expect(defs).to.have.length(3);
        done();
      });
    });

    it('should be able to create multiple policies', function(done) {
      Policy.find(function(err, defs) {
        if (err) return done(err);
        expect(defs).to.have.length(3);
        done();
      });
    });

    it('should be able to create multiple pipelines', function(done) {
      Pipeline.find(function(err, defs) {
        if (err) return done(err);
        expect(defs).to.have.length(1);
        done();
      });
    });

    it('should be able to list scopes', function(done) {
      GatewayMap.getAuthScopes(function(err, scopes) {
        if (err) return done(err);
        expect(scopes).to.eql({
            catalog: [{verb: 'GET', endpoint: '/api/catalog'},
              {verb: 'ALL', endpoint: '/api/invoices'}],
            shopping: [{verb: 'GET', endpoint: '/api/catalog'},
              {verb: 'ALL', endpoint: '/api/invoices'}]
          }
        );
        done();
      });
    });

    it('should be able to rename a policy', function(done) {
      Policy.rename('auth-catalog', 'auth-catalog-1', function(err, policy) {
        if (err) return done(err);
        Pipeline.find(function(err, defs) {
          expect(defs).to.have.length(1);
          expect(defs[0].policyIds).to.contain('auth-catalog-1');
          done();
        });
      });
    });

    it('should be able to rename a pipeline', function(done) {
      Pipeline.rename('default-pipeline', 'default-pipeline-1', function(err, pipeline) {
        if (err) return done(err);
        GatewayMap.find(function(err, defs) {
          expect(defs).to.have.length(3);
          defs.forEach(function(m) {
            if (m.name !== 'order') {
              expect(m.pipelineId).to.eql('default-pipeline-1');
            }
          });
          done();
        });
      });
    });

  });
});
