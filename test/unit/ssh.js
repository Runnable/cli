'use strict'

var EventEmitter = require('events')
if (/^v0\.1\d\.\d\d$/.test(process.version)) {
  EventEmitter = require('events').EventEmitter
}
var chai = require('chai')
var sinon = require('sinon')

require('sinon-as-promised')(require('bluebird'))
chai.use(require('chai-as-promised'))
var assert = chai.assert

var utils = require('../../lib/utils')
var ssh = require('../../lib/ssh')

describe('SSH Methods', function () {
  var mockArgs
  var mockInstance
  var mockSocket
  var mockSubstream

  describe('connectTerminalStream', function () {
    beforeEach(function () {
      sinon.stub(utils, 'getRepositoryAndInstance').resolves([ mockArgs, mockInstance ])
      sinon.stub(ssh, '_connectToContainerStream').resolves()
    })

    afterEach(function () {
      utils.getRepositoryAndInstance.restore()
      ssh._connectToContainerStream.restore()
    })

    describe('errors', function () {
      it('should reject with any getRepositoryAndInstance error', function () {
        utils.getRepositoryAndInstance.rejects(new Error('robot'))
        return assert.isRejected(
          ssh.connectTerminalStream(mockArgs),
          Error,
          'robot'
        )
      })

      it('should reject with any _connectToContainerStream error', function () {
        ssh._connectToContainerStream.rejects(new Error('doobie'))
        return assert.isRejected(
          ssh.connectTerminalStream(mockArgs),
          Error,
          'doobie'
        )
      })
    })

    it('should get the repository and instance', function () {
      return assert.isFulfilled(ssh.connectTerminalStream(mockArgs))
        .then(function () {
          sinon.assert.calledOnce(utils.getRepositoryAndInstance)
          sinon.assert.calledWithExactly(
            utils.getRepositoryAndInstance,
            mockArgs
          )
        })
    })

    it('should connect to the container stream', function () {
      return assert.isFulfilled(ssh.connectTerminalStream(mockArgs))
        .then(function () {
          sinon.assert.calledOnce(ssh._connectToContainerStream)
          sinon.assert.calledWithExactly(
            ssh._connectToContainerStream,
            mockArgs,
            mockInstance
          )
        })
    })
  })

  describe('_connectToContainerStream', function () {
    beforeEach(function () {
      mockInstance = {
        container: {
          dockerContainer: 'mockContainerId',
          dockerHost: 'http://example.com:4242'
        }
      }
      mockSubstream = new EventEmitter()
      mockSubstream.pipe = sinon.stub()
      sinon.spy(mockSubstream, 'on')
      mockSocket = new EventEmitter()
      mockSocket.substream = sinon.stub().returns(mockSubstream)
      mockSocket.write = sinon.stub()
      mockSocket.end = sinon.stub()
      sinon.stub(utils, 'createSocket').returns(mockSocket)
      sinon.spy(process.stdin, 'setEncoding')
      sinon.spy(process.stdin, 'setRawMode')
      sinon.stub(process.stdin, 'end')
      if (!process.stdin.resume.isSinonProxy) {
        sinon.spy(process.stdin, 'resume')
      }
      if (!process.stdin.pipe.isSinonProxy) {
        sinon.stub(process.stdin, 'pipe')
      }
    })

    afterEach(function () {
      utils.createSocket.restore()
      process.stdin.setEncoding.restore()
      process.stdin.setRawMode.restore()
      process.stdin.end.restore()
      if (process.stdin.resume.isSinonProxy) {
        process.stdin.resume.restore()
      }
      if (process.stdin.pipe.isSinonProxy) {
        process.stdin.pipe.restore()
      }
    })

    it('should create a socket', function () {
      return assert.isFulfilled(ssh._connectToContainerStream(mockArgs, mockInstance))
        .then(function () {
          sinon.assert.calledOnce(utils.createSocket)
          sinon.assert.calledWithExactly(
            utils.createSocket,
            mockArgs
          )
        })
    })

    it('should create a terminal stream', function () {
      return assert.isFulfilled(ssh._connectToContainerStream(mockArgs, mockInstance))
        .then(function () {
          sinon.assert.calledOnce(mockSocket.substream)
          sinon.assert.calledWithExactly(
            mockSocket.substream,
            sinon.match(/^mockContainerId\-/)
          )
        })
    })

    it('should add an end handler for the substream', function () {
      return assert.isFulfilled(ssh._connectToContainerStream(mockArgs, mockInstance))
        .then(function () {
          sinon.assert.calledOnce(mockSubstream.on)
          sinon.assert.calledWithExactly(
            mockSubstream.on,
            'end',
            sinon.match.func
          )
        })
    })

    it('should clean up streams when the substream ends', function () {
      return assert.isFulfilled(ssh._connectToContainerStream(mockArgs, mockInstance))
        .then(function () {
          mockSubstream.emit('end')
          sinon.assert.calledOnce(process.stdin.end)
          sinon.assert.calledOnce(mockSocket.end)
        })
    })

    it('should setup stdin correctly', function () {
      return assert.isFulfilled(ssh._connectToContainerStream(mockArgs, mockInstance))
        .then(function () {
          sinon.assert.calledOnce(process.stdin.setEncoding)
          sinon.assert.calledWithExactly(
            process.stdin.setEncoding,
            'utf-8'
          )
          sinon.assert.calledOnce(process.stdin.setRawMode)
          sinon.assert.calledWithExactly(
            process.stdin.setRawMode,
            true
          )
          sinon.assert.calledOnce(process.stdin.resume)
          sinon.assert.calledWithExactly(process.stdin.resume)
          sinon.assert.calledOnce(process.stdin.pipe)
          sinon.assert.calledWithExactly(
            process.stdin.pipe,
            mockSubstream
          )
        })
    })

    describe('when stdin is not tty', function () {
      var prevTTY = process.stdin.isTTY
      beforeEach(function () {
        process.stdin.isTTY = false
      })

      afterEach(function () {
        process.stdin.isTTY = prevTTY
      })

      it('should not set raw mode', function () {
        return assert.isFulfilled(ssh._connectToContainerStream(mockArgs, mockInstance))
          .then(function () {
            sinon.assert.notCalled(process.stdin.setRawMode)
          })
      })
    })

    it('should pipe the terminal stream to stdout', function () {
      return assert.isFulfilled(ssh._connectToContainerStream(mockArgs, mockInstance))
        .then(function () {
          sinon.assert.calledOnce(mockSubstream.pipe)
          sinon.assert.calledWithExactly(
            mockSubstream.pipe,
            process.stdout
          )
        })
    })

    it('should write to the socket to start the substream', function () {
      return assert.isFulfilled(ssh._connectToContainerStream(mockArgs, mockInstance))
        .then(function () {
          sinon.assert.calledOnce(mockSocket.write)
          sinon.assert.calledWithExactly(
            mockSocket.write,
            {
              id: 1,
              event: 'terminal-stream',
              data: {
                dockHost: 'http://example.com:4242',
                type: 'filibuster',
                containerId: 'mockContainerId',
                terminalStreamId: sinon.match(/^mockContainerId-/),
                eventStreamId: sinon.match(/^mockContainerId-.+events$/)
              }
            }
          )
        })
    })
  })
})
