'use strict'

const debug = require('debug')('runnable-cli:utils')
const exists = require('101/exists')
const find = require('101/find')
const hasKeypaths = require('101/has-keypaths')
const hasProps = require('101/has-properties')
const keypather = require('keypather')()
const parseGithubURL = require('parse-github-url')
const Promise = require('bluebird')
const simpleGit = require('simple-git')
const substream = require('substream')

const Runnable = require('./runnable')

class Utils extends Runnable {
  static getRepositoryAndInstance (args) {
    return Promise.resolve()
      .then(() => {
        if (!args.repository) {
          return Utils.getRepositoryForCurrentDirectory()
            .then((repository) => {
              args.repository = repository
            })
        }
      })
      .then(() => {
        return Utils.fetchInstanceForRepository(args)
      })
      .then((instance) => {
        if (!instance) { throw new Error('Could not find Container.') }
        return [ args, instance ]
      })
  }

  static createSocket (args) {
    const cookies = Utils.user.client.opts.jar.getCookieString(Utils.user.host)
    const socket = Utils.user.createSocket({
      transformer: 'websockets',
      parser: 'JSON',
      plugin: { substream: substream },
      transport: {
        headers: { cookie: cookies }
      }
    })

    socket.on('data', (data) => {
      if (data.error) { console.error(data.error) }
    })

    socket.on('error', console.error.bind(console))

    return socket
  }

  static getRepositoryForCurrentDirectory () {
    const cwd = process.cwd()
    return Promise.props({
      origin: Promise.fromCallback((callback) => {
        simpleGit(cwd).getRemotes(true, callback)
      })
        .then((remotes) => {
          return find(remotes, hasProps({ name: 'origin' }))
        }),
      branch: Promise.fromCallback((callback) => {
        simpleGit(cwd).revparse([ '--abbrev-ref', 'HEAD' ], callback)
      })
        .then((branch) => {
          return branch.toString().trim()
        })
    })
      .then((results) => {
        const branch = results.branch
        let origin = keypather.get(results.origin, 'refs.push')
        if (!origin) {
          throw new Error('No remote repo with name `origin` found.')
        }
        origin = parseGithubURL(origin)
        const repository = `${origin.name}/${branch}`
        return repository
      })
  }

  static fetchInstanceForRepository (args) {
    const org = Utils.user._org
    let branch
    let repo = args.repository
    if (repo.indexOf('/') !== -1) {
      branch = repo.split('/').pop()
      repo = repo.split('/').shift()
    }
    const fullRepo = `${org}/${repo}`
    debug(`fetching instances for repository ${fullRepo}`)
    return Promise.fromCallback(function fetchInstances (callback) {
      const opts = {
        githubUsername: org,
        'contextVersion.appCodeVersions.repo': fullRepo
      }
      Utils.user.fetchInstances(opts, callback)
    })
      .then(function findDesiredInstance (instances) {
        debug('found ' + instances.length + ' instances for repository')
        // if we don't have a branch, we want the instance w/ the default branch
        // equal to the branch the context version is using (not assuming
        // master)
        if (branch) {
          const search = {
            'contextVersion.appCodeVersions[0].lowerBranch': branch.toLowerCase()
          }
          return find(instances, hasKeypaths(search))
        } else {
          return find(instances, (i) => {
            const defaultBranch = keypather.get(i, 'contextVersion.appCodeVersions[0].defaultBranch')
            const lowerBranch = keypather.get(i, 'contextVersion.appCodeVersions[0].lowerBranch')
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
          const opts = {
            githubUsername: org,
            name: args.repository
          }
          Utils.user.fetchInstances(opts, callback)
        })
          .then((instances) => {
            debug('found ' + instances.length + ' instances for non-repository')
            if (instances.length) { return instances[0] }
          })
      })
  }
}

module.exports = Utils
