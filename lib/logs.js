'use strict'

const keypather = require('keypather')()
const Promise = require('bluebird')
const streamCleanser = require('docker-stream-cleanser')('hex')
const uuid = require('uuid')

const Runnable = require('./runnable')
const utils = require('./utils')

class Logs extends Runnable {
  static connectContainerLogs (args) {
    return utils.getRepositoryAndInstance(args)
      .spread(function (argsWithRepo, instance) {
        if (argsWithRepo.cmd) {
          return Logs._connectToContainerLogs(argsWithRepo, instance)
        }
        if (argsWithRepo.build) {
          return Logs._connectToContainerBuildLogs(argsWithRepo, instance)
        }
        throw new Error('not sure what logs to connect')
      })
  }

  static _connectToContainerBuildLogs (args, instance) {
    return Promise.try(() => {
      const socket = utils.createSocket(args)

      const contextVersionId = keypather.get(instance, 'contextVersion._id')
      const substreamId = contextVersionId + '-' + uuid()
      const logStream = socket.substream(substreamId)

      logStream.on('end', () => { socket.end() })

      const printTypes = [ 'log', 'docker' ]
      logStream.on('data', (data) => {
        if (Array.isArray(data)) {
          data.forEach((d) => {
            if (printTypes.indexOf(d.type) !== -1) {
              process.stdout.write(d.content)
            }
          })
        } else {
          if (printTypes.indexOf(data.type) !== -1) {
            process.stdout.write(data.content)
          }
        }
      })

      logStream.on('error', console.error.bind(console))

      socket.write({
        id: 1,
        event: 'build-stream',
        data: {
          streamId: substreamId,
          id: contextVersionId
        }
      })
    })
  }

  static _connectToContainerLogs (args, instance) {
    return Promise.try(() => {
      const socket = utils.createSocket(args)

      const containerId = keypather.get(instance, 'container.dockerContainer')
      const substreamId = containerId
      const logStream = socket.substream(substreamId)

      logStream.on('end', () => { socket.end() })

      logStream.pipe(streamCleanser).pipe(process.stdout)

      socket.write({
        id: 1,
        event: 'log-stream',
        data: {
          substreamId: substreamId,
          dockHost: 'TO BE REMOVED',
          containerId: containerId
        }
      })
    })
  }
}

module.exports = Logs
