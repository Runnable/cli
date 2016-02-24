'use strict'

var Promise = require('bluebird')
var debug = require('debug')('runnable-cli:utils')
var exists = require('101/exists')
var find = require('101/find')
var hasKeypaths = require('101/has-keypaths')
var hasProps = require('101/has-properties')
var keypather = require('keypather')()
var parseGithubURL = require('parse-github-url')
var simpleGit = require('simple-git')
var substream = require('substream')

var utils = module.exports = {
  getRepositoryAndInstance: Promise.method(function (args) {
    return Promise.resolve()
      .then(function () {
        if (!args.repository) {
          return utils.getRepositoryForCurrentDirectory()
            .then(function (repository) {
              args.repository = repository
            })
        }
      })
      .then(function () {
        return utils.fetchInstanceForRepository(args)
      })
      .then(function (instance) {
        if (!instance) { throw new Error('Could not find Container.') }
        return [ args, instance ]
      })
  }),

  createSocket: function (args) {
    var cookies = args._user.client.opts.jar.getCookieString(args._user.host)
    var socket = args._user.createSocket({
      transformer: 'websockets',
      parser: 'JSON',
      plugin: { substream: substream },
      transport: {
        headers: { cookie: cookies }
      }
    })

    socket.on('data', function (data) {
      if (data.error) { console.error(data.error) }
    })

    socket.on('error', function (error) { console.error(error) })

    return socket
  },

  getRepositoryForCurrentDirectory: Promise.method(function () {
    var cwd = process.cwd()
    return Promise.props({
      origin: Promise.fromCallback(function (callback) {
        simpleGit(cwd).getRemotes(true, callback)
      })
        .then(function (remotes) {
          return find(remotes, hasProps({ name: 'origin' }))
        }),
      branch: Promise.fromCallback(function (callback) {
        simpleGit(cwd).revparse([ '--abbrev-ref', 'HEAD' ], callback)
      })
        .then(function (branch) {
          return branch.toString().trim()
        })
    })
      .then(function (results) {
        var branch = results.branch
        var origin = parseGithubURL(results.origin.refs.push)
        var repository = origin.name + '/' + branch
        return repository
      })
  }),

  fetchInstanceForRepository: Promise.method(function (args) {
    var org = args._user._org
    var branch
    var repo = args.repository
    if (repo.indexOf('/') !== -1) {
      branch = repo.split('/').pop()
      repo = repo.split('/').shift()
    }
    var fullRepo = org + '/' + repo
    debug('fetching instances for repository ' + fullRepo)
    return Promise.fromCallback(function fetchInstances (callback) {
      var opts = {
        githubUsername: org,
        'contextVersion.appCodeVersions.repo': fullRepo
      }
      args._user.fetchInstances(opts, callback)
    })
      .then(function findDesiredInstance (instances) {
        debug('found ' + instances.length + ' instances for repository')
        // if we don't have a branch, we want the instance w/ the default branch
        // equal to the branch the context version is using (not assuming
        // master)
        if (branch) {
          var search = {
            'contextVersion.appCodeVersions[0].lowerBranch': branch.toLowerCase()
          }
          return find(instances, hasKeypaths(search))
        } else {
          return find(instances, function (i) {
            var defaultBranch = keypather.get(i, 'contextVersion.appCodeVersions[0].defaultBranch')
            var lowerBranch = keypather.get(i, 'contextVersion.appCodeVersions[0].lowerBranch')
            // it's possible for defaultBranch to not exist for very old models
            if (!exists(defaultBranch)) { return false }
            return defaultBranch.toLowerCase() === lowerBranch
          })
        }
      })
      .then(function checkForNonRepoContainer (instance) {
        if (instance) { return instance }
        debug('looking for a non-repository container for ' + args.repository)
        return Promise.fromCallback(function fetchNonRepoInstances (callback) {
          var opts = {
            githubUsername: org,
            name: args.repository
          }
          args._user.fetchInstances(opts, callback)
        })
          .then(function (instances) {
            debug('found ' + instances.length + ' instances for non-repository')
            if (instances.length) { return instances[0] }
          })
      })
  })
}
