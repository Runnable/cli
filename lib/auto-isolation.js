'use strict'

const keypather = require('keypather')()
const Promise = require('bluebird')
const pluck = require('101/pluck')
const promiseWhile = require('promise-while')(Promise)
const find = require('101/find')

const Runnable = require('./runnable')
const Utils = require('./utils')

const read = Promise.promisify(require('read'))

class AutoIsolation extends Runnable {
  static connectContainerLogs (args) {
    if (!args.enable && !args.disable) {
      return AutoIsolation.list(args)
    }
    return Utils.getRepositoryAndInstance(args)
      .spread((argsWithRepo, instance) => {
        const lowerRepo = argsWithRepo.repository.toLowerCase()
        argsWithRepo.repository = lowerRepo
        argsWithRepo._instance = instance
        console.log(`Going to toggle isolation for: ${lowerRepo}`)
        return argsWithRepo
      })
      .then((argsWithRepo) => {
        if (argsWithRepo.enable) {
          return AutoIsolation.enable(argsWithRepo)
        } else if (argsWithRepo.disable) {
          return AutoIsolation.disable(argsWithRepo)
        } else {
          throw new Error('not implemented')
        }
      })
  }

  static disable (args) {
    return Promise.fromCallback((callback) => {
      const opts = {
        qs: { instance: args._instance._id }
      }
      AutoIsolation.user.fetchAutoIsolationConfigs(opts, callback)
    })
      .then((configs) => {
        if (!configs.length) {
          console.log(`No configurations exist for ${args.repository}.`)
        }
        return Promise.fromCallback((callback) => {
          AutoIsolation.user.newAutoIsolationConfig(configs[0]._id).destroy(callback)
        })
      })
      .then(() => {
        console.log('Configuration destroyed.')
      })
  }

  static list (args) {
    return Promise.fromCallback((callback) => {
      const opts = {
        githubUsername: AutoIsolation.user._org.toLowerCase(),
        masterPod: true
      }
      if (args.repository) {
        opts.name = args.repository
      }
      AutoIsolation.user.fetchInstances(opts, callback)
    })
      .then((instances) => {
        const mapping = {}
        instances.forEach((i) => {
          mapping[i._id] = Promise.fromCallback((callback) => {
            const opts = {
              qs: { instance: i._id }
            }
            AutoIsolation.user.fetchAutoIsolationConfigs(opts, callback)
          })
            .then((configs) => {
              if (!configs.length) { return null }
              return configs[0]
            })
        })
        return Promise.props(mapping)
          .then((instanceMap) => {
            instances.forEach(function (i) {
              let state = 'not isolated'
              if (instanceMap[i._id]) {
                state = `is isolated with ${instanceMap[i._id].requestedDependencies.length} dependencies`
              }
              console.log(`${i.lowerName} ${state}.`)
            })
          })
      })
  }

  static enable (args) {
    return Promise.resolve().then(() => {
      return Promise.fromCallback((callback) => {
        const opts = {
          githubUsername: AutoIsolation.user._org.toLowerCase(),
          masterPod: true
        }
        AutoIsolation.user.fetchInstances(opts, callback)
      })
        .then((instances) => {
          const lowerNames = instances.map(pluck('lowerName'))
            .filter((n) => { return n !== args.repository })
          console.log(`[DEBUG] Available instances: ${lowerNames.join(', ')}`)
          let done = false
          const requestedDependencies = []
          return promiseWhile(
            () => { return !done },
            () => {
              const repoList = lowerNames.map((r, i) => {
                return `  ${i + 1}) ${r}`
              })
              const prompt = [
                'Select via NUMBER which repository you would like to include:',
                '',
                repoList.join('\n'),
                '',
                '(`q` to stop) >'
              ].join('\n')
              return read({ prompt: prompt })
                .then((selection) => {
                  if (selection.toLowerCase() === 'q' || selection === '') {
                    done = true
                    return
                  }
                  const index = parseInt(selection, 10) - 1
                  const selectedName = lowerNames[index]
                  const instance = find(instances, (i) => { return i.lowerName === selectedName })
                  const branch = keypather.get(instance, 'contextVersion.appCodeVersions[0].lowerBranch')
                  if (!branch) {
                    console.log(`${selectedName} added.`)
                    requestedDependencies.push({ instance: instance._id })
                  } else {
                    return read({
                      prompt: 'What branch would you like isolated:',
                      default: 'master'
                    })
                      .then((selectedBranch) => {
                        const obj = {
                          org: AutoIsolation.user._org.toLowerCase(),
                          repo: args.repository.split('/').pop().toLowerCase(),
                          branch: selectedBranch.toLowerCase()
                        }
                        console.log(`${obj.org}/${obj.repo}@${obj.branch} added.`)
                        requestedDependencies.push(obj)
                      })
                  }
                })
            }
          )
            .then(() => {
              return requestedDependencies
            })
        })
        .then((requestedDependencies) => {
          console.log(`[DEBUG] requestedDependencies: ${JSON.stringify(requestedDependencies)}`)
          return Promise.fromCallback((callback) => {
            AutoIsolation.user.createAutoIsolationConfig({
              instance: args._instance._id,
              requestedDependencies: requestedDependencies
            }, callback)
          })
        })
        .then((autoIsolationConfig) => {
          console.log(`[DEBUG] created config: ${JSON.stringify(autoIsolationConfig)}`)
        })
    })
      .catch((err) => { console.error(err.stack || err); throw err })
  }
}

module.exports = AutoIsolation
