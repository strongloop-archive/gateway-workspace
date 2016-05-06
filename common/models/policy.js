// Copyright IBM Corp. 2015. All Rights Reserved.
// Node module: gateway-workspace
// This file is licensed under the MIT License.
// License text available at https://opensource.org/licenses/MIT

var async = require('async');

module.exports = function(Policy) {
  Policy.getUniqueId = function(data) {
    return data.name || data.id;
  };

  /**
   * Find all pipelines that reference the given policy
   * @param {String} name Policy name
   * @param cb
   */
  Policy.findPipelineRefs = function(name, cb) {
    Policy.findOne({where: {name: name}}, function(err, policy) {
      if (err || !policy) return cb(err);
      var Pipeline = Policy.app.models.Pipeline;
      Pipeline.find(function(err, pipelines) {
        if (err) return cb(err);
        var matched = pipelines.filter(function(p) {
          return p.policyIds.indexOf(policy.id) !== -1;
        });
        cb(null, {policy: policy, pipelines: matched});
      });
    });
  };

  /**
   * Rename a policy and adjust pipelines that reference the policy
   * @param {String} currentName Current name
   * @param {String} newName New name
   * @param cb
   */
  Policy.rename = function(currentName, newName, cb) {
    if (currentName === newName) {
      return process.nextTick(function() {
        cb(null, false);
      });
    }
    this.findPipelineRefs(currentName, function(err, result) {
      if (err || !result) return cb(err, false);
      var oldId = result.policy.id;
      result.policy.updateAttributes({name: newName}, function(err, policy) {
        if (err) return cb(err);
        policy.id = Policy.getUniqueId(policy);
        async.each(result.pipelines, function(p, done) {
          var ids = p.policyIds;
          ids.forEach(function(id, index) {
            if (id === oldId) {
              ids[index] = newName;
            }
          });
          p.updateAttributes({policyIds: ids}, done);
        }, function(err) {
          if (err) return cb(err);
          cb(null, policy);
        });
      });
    });
  };

  Policy.remoteMethod('rename', {
    isStatic: true,
    accepts: [{
      arg: 'currentName',
      type: 'string',
      required: true,
      description: 'Current name'
    },
      {
        arg: 'newName',
        type: 'string',
        required: true,
        description: 'New name'
      }
    ],
    returns: [
      {
        arg: 'policy',
        type: 'Policy',
        root: true
      }
    ]
  });

  /**
   * Delete a policy by name
   * @param {string} name Policy name
   * @param {Boolean} force
   * @param cb
   */
  Policy.deleteByName = function(name, force, cb) {
    if (cb === undefined && typeof force === 'function') {
      cb = force;
      force = false;
    }
    this.findPipelineRefs(name, function(err, result) {
      if (err) return cb(err, false);
      if (!result) {
        // Cannot find the policy by name
        err = new Error('Policy not found: ' + name);
        err.statusCode = 404;
        cb(err);
        return;
      }
      if (!force) {
        if (Array.isArray(result.pipelines) && result.pipelines.length > 0) {
          // Cannot delete the policy as it's in use
          err = new Error('Policy cannot be deleted as it is in use');
          err.statusCode = 400;
          cb(err);
          return;
        }
      }
      async.each(result.pipelines, function(p, done) {
        // Remove the policy ref
        p.policies.remove(result.policy, done);
      }, function(err) {
        if (err) return cb(err);
        result.policy.destroy(function(err) {
          if (err) return cb(err);
          cb(null, true);
        });
      });
    });
  };

  Policy.remoteMethod('deleteByName', {
    isStatic: true,
    accepts: [{
      arg: 'name',
      type: 'string',
      required: true,
      http: {source: 'path'},
      description: 'Policy name'
    }, {
      arg: 'force',
      type: 'boolean',
      http: {source: 'query'},
      description: 'Force delete'
    }],
    returns: [
      {
        arg: 'result',
        type: 'boolean',
        root: true
      }
    ],
    http: {
      verb: 'delete',
      path: '/names/:name'
    }
  });
};
