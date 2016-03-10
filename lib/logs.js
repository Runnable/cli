'use strict'

var Promise = require('bluebird')
var streamCleanser = require('docker-stream-cleanser')('hex')
var keypather = require('keypather')()
var uuid = require('uuid')

var utils = require('./utils')

var Logs = module.exports = {
  connectContainerLogs: Promise.method(function (args) {
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
  }),

  _connectToContainerBuildLogs: Promise.method(function (args, instance) {
    var socket = utils.createSocket(args)

    var contextVersionId = keypather.get(instance, 'contextVersion._id')
    var substreamId = contextVersionId + '-' + uuid()
    var logStream = socket.substream(substreamId)

    logStream.on('end', function () { socket.end() })

    var printTypes = [ 'log', 'docker' ]
    logStream.on('data', function (data) {
      if (Array.isArray(data)) {
        data.forEach(function (d) {
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

    logStream.on('error', function (error) { console.error(error) })

    socket.write({
      id: 1,
      event: 'build-stream',
      data: {
        streamId: substreamId,
        id: contextVersionId
      }
    })
  }),

  _connectToContainerLogs: Promise.method(function (args, instance) {
    var socket = utils.createSocket(args)

    var containerId = keypather.get(instance, 'container.dockerContainer')
    var substreamId = containerId
    var logStream = socket.substream(substreamId)

    logStream.on('end', function () { socket.end() })

    logStream.pipe(streamCleanser).pipe(process.stdout)

    utils.socketReconnectionLogic(socket, process.stdout, function () {
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
  })
}
