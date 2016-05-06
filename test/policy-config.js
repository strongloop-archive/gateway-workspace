// Copyright IBM Corp. 2015. All Rights Reserved.
// Node module: gateway-workspace
// This file is licensed under the MIT License.
// License text available at https://opensource.org/licenses/MIT

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

  require('../server/index')(app, {});
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
  async.each(workspace.models(), function(model, done) {
    if (typeof model.destroyAll === 'function') {
      // Some workspace models are not attached to a DB
      model.destroyAll(done);
    } else {
      done();
    }
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
  var GatewayMapping = workspace.models.GatewayMapping;
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

  describe('create models for mappings/pipelines/policies', function() {
    beforeEach(givenEmptyWorkspace);
    beforeEach(function(done) {
      var serverFacet = this.serverFacet;
      this.configFile = new ConfigFile({
        path: serverFacet + '/policy-config.json'
      });
      async.series([
        createPoliciesAndPipelines,
        function(done) {
          GatewayMapping.create({
            name: 'catalog',
            verb: 'GET',
            endpoint: '/api/catalog',
            pipelineId: 'default-pipeline'
          }, done);
        },
        function(done) {
          GatewayMapping.create({
            name: 'invoice',
            verb: 'ALL',
            endpoint: '/api/invoices',
            pipelineId: 'default-pipeline'
          }, done);
        }, function(done) {
          GatewayMapping.create({
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

    it('should be able to create multiple mappings', function(done) {
      GatewayMapping.find(function(err, defs) {
        if (err) return done(err);
        expect(defs).to.have.length(3);
        done();
      });
    });

    it('should be able to rename a mapping', function(done) {
      GatewayMapping.rename('catalog', 'catalog-read',
        function(err, mapping) {
          if (err) return done(err);
          GatewayMapping.find({where: {name: 'catalog-read'}},
            function(err, defs) {
              expect(defs).to.have.length(1);
              GatewayMapping.find({where: {name: 'catalog'}},
                function(err, defs) {
                  expect(defs).to.have.length(0);
                  GatewayMapping.find({where: {id: 'catalog-read'}},
                    function(err, defs) {
                      expect(defs).to.have.length(1);
                      done();
                    });
                });
            });
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
      GatewayMapping.getAuthScopes(function(err, scopes) {
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
      Pipeline.rename('default-pipeline', 'default-pipeline-1',
        function(err, pipeline) {
          if (err) return done(err);
          GatewayMapping.find(function(err, defs) {
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

    it('should be able to force delete a policy by name', function(done) {
      Policy.deleteByName('auth-catalog', true, function(err, result) {
        if (err) return done(err);
        expect(result).to.equal(true);
        Pipeline.find(function(err, defs) {
          expect(defs).to.have.length(1);
          expect(defs[0].policyIds).to.not.contain('auth-catalog');
          done();
        });
      });
    });

    it('should not be able to delete a in-use policy by name', function(done) {
      Policy.deleteByName('auth-catalog', false, function(err, result) {
        expect(err).to.be.instanceof(Error);
        expect(err.statusCode).to.eql(400);
        Pipeline.find(function(err, defs) {
          expect(defs).to.have.length(1);
          expect(defs[0].policyIds).to.contain('auth-catalog');
          done();
        });
      });
    });

    it('should report error if policy to be renamed not found', function(done) {
      Policy.deleteByName('auth-catalog-xx', false, function(err, result) {
        expect(err).to.be.instanceof(Error);
        expect(err.statusCode).to.eql(404);
        Pipeline.find(function(err, defs) {
          expect(defs).to.have.length(1);
          expect(defs[0].policyIds).to.contain('auth-catalog');
          done();
        });
      });
    });

    it('should be able to force delete a pipeline by name', function(done) {
      Pipeline.deleteByName('default-pipeline', true, function(err, result) {
        if (err) return done(err);
        expect(result).to.equal(true);
        GatewayMapping.find(function(err, defs) {
          expect(defs).to.have.length(3);
          defs.forEach(function(m) {
            expect(m.pipelineId).to.not.eql('default-pipeline');
          });
          done();
        });
      });
    });

    it('should not be able to delete a in-use pipeline by name',
      function(done) {
        Pipeline.deleteByName('default-pipeline', false, function(err, result) {
          expect(err).to.be.instanceof(Error);
          expect(err.statusCode).to.eql(400);
          GatewayMapping.find(function(err, defs) {
            expect(defs).to.have.length(3);
            defs.forEach(function(m) {
              if (m.name !== 'order') {
                expect(m.pipelineId).to.eql('default-pipeline');
              }
            });
            done();
          });
        });
      });

    it('should report error if pipeline to be renamed not found', function(done) {
      Pipeline.deleteByName('default-pipeline-xx', false, function(err, result) {
        expect(err).to.be.instanceof(Error);
        expect(err.statusCode).to.eql(404);
        GatewayMapping.find(function(err, defs) {
          expect(defs).to.have.length(3);
          defs.forEach(function(m) {
            if (m.name !== 'order') {
              expect(m.pipelineId).to.eql('default-pipeline');
            }
          });
          done();
        });
      });
    });

  });
});
