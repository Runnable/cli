'use strict'

const Promise = require('bluebird')
const keypather = require('keypather')()
const uuid = require('uuid')

const Runnable = require('./runnable')
const utils = require('./utils')

class SSH extends Runnable {
  static connectTerminalStream (args) {
    return utils.getRepositoryAndInstance(args)
      .spread(function (argsWithRepo, instance) {
        return SSH._connectToContainerStream(argsWithRepo, instance)
      })
  }

  static _connectToContainerStream (args, instance) {
    return Promise.try(() => {
      const socket = utils.createSocket(args)

      const containerId = keypather.get(instance, 'container.dockerContainer')
      const dockerHost = keypather.get(instance, 'container.dockerHost')
      const terminalStreamId = containerId + '-' + uuid()
      const eventStreamId = terminalStreamId + '-events'

      const terminalStream = socket.substream(terminalStreamId)

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
}

module.exports = SSH
