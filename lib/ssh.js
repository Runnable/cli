'use strict'

var Promise = require('bluebird')
var keypather = require('keypather')()
var uuid = require('uuid')

var utils = require('./utils')

var ssh = module.exports = {
  connectTerminalStream: Promise.method(function (args) {
    return utils.getRepositoryAndInstance(args)
      .spread(function (argsWithRepo, instance) {
        return ssh._connectToContainerStream(argsWithRepo, instance)
      })
  }),

  _connectToContainerStream: Promise.method(function (args, instance) {
    var socket = utils.createSocket(args)

    var containerId = keypather.get(instance, 'container.dockerContainer')
    var dockerHost = keypather.get(instance, 'container.dockerHost')
    var terminalStreamId = containerId + '-' + uuid()
    var eventStreamId = terminalStreamId + '-events'

    var terminalStream = socket.substream(terminalStreamId)

    terminalStream.on('end', function () {
      // close the stdin stream so the command will exit
      process.stdin.end()
      socket.end()
    })

    process.stdin.setEncoding('utf-8')
    if (process.stdin.isTTY) {
      process.stdin.setRawMode(true)
    }
    process.stdin.resume()
    process.stdin.pipe(terminalStream)
    terminalStream.pipe(process.stdout)

    socket.write({
      id: 1,
      event: 'terminal-stream',
      data: {
        dockHost: dockerHost,
        type: 'filibuster',
        containerId: containerId,
        terminalStreamId: terminalStreamId,
        eventStreamId: eventStreamId
      }
    })
  })
}
