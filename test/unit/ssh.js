'use strict'

const EventEmitter = require('events')
const chai = require('chai')
const sinon = require('sinon')

require('sinon-as-promised')(require('bluebird'))
chai.use(require('chai-as-promised'))
const assert = chai.assert

const Utils = require('../../lib/utils')
const SSH = require('../../lib/ssh')

describe('SSH Methods', () => {
  let mockArgs
  let mockInstance
  let mockSocket
  let mockSubstream

  describe('connectTerminalStream', () => {
    beforeEach(() => {
      sinon.stub(Utils, 'getRepositoryAndInstance').resolves([ mockArgs, mockInstance ])
      sinon.stub(SSH, '_connectToContainerStream').resolves()
    })

    afterEach(() => {
      Utils.getRepositoryAndInstance.restore()
      SSH._connectToContainerStream.restore()
    })

    describe('errors', () => {
      it('should reject with any getRepositoryAndInstance error', () => {
        Utils.getRepositoryAndInstance.rejects(new Error('robot'))
        return assert.isRejected(
          SSH.connectTerminalStream(mockArgs),
          Error,
          'robot'
        )
      })

      it('should reject with any _connectToContainerStream error', () => {
        SSH._connectToContainerStream.rejects(new Error('doobie'))
        return assert.isRejected(
          SSH.connectTerminalStream(mockArgs),
          Error,
          'doobie'
        )
      })
    })

    it('should get the repository and instance', () => {
      return assert.isFulfilled(SSH.connectTerminalStream(mockArgs))
        .then(() => {
          sinon.assert.calledOnce(Utils.getRepositoryAndInstance)
          sinon.assert.calledWithExactly(
            Utils.getRepositoryAndInstance,
            mockArgs
          )
        })
    })

    it('should connect to the container stream', () => {
      return assert.isFulfilled(SSH.connectTerminalStream(mockArgs))
        .then(() => {
          sinon.assert.calledOnce(SSH._connectToContainerStream)
          sinon.assert.calledWithExactly(
            SSH._connectToContainerStream,
            mockArgs,
            mockInstance
          )
        })
    })
  })

  describe('_connectToContainerStream', () => {
    beforeEach(() => {
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
      sinon.stub(Utils, 'createSocket').returns(mockSocket)
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

    afterEach(() => {
      Utils.createSocket.restore()
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

    it('should create a socket', () => {
      return assert.isFulfilled(SSH._connectToContainerStream(mockArgs, mockInstance))
        .then(() => {
          sinon.assert.calledOnce(Utils.createSocket)
          sinon.assert.calledWithExactly(
            Utils.createSocket,
            mockArgs
          )
        })
    })

    it('should create a terminal stream', () => {
      return assert.isFulfilled(SSH._connectToContainerStream(mockArgs, mockInstance))
        .then(() => {
          sinon.assert.calledOnce(mockSocket.substream)
          sinon.assert.calledWithExactly(
            mockSocket.substream,
            sinon.match(/^mockContainerId\-/)
          )
        })
    })

    it('should add an end handler for the substream', () => {
      return assert.isFulfilled(SSH._connectToContainerStream(mockArgs, mockInstance))
        .then(() => {
          sinon.assert.calledOnce(mockSubstream.on)
          sinon.assert.calledWithExactly(
            mockSubstream.on,
            'end',
            sinon.match.func
          )
        })
    })

    it('should clean up streams when the substream ends', () => {
      return assert.isFulfilled(SSH._connectToContainerStream(mockArgs, mockInstance))
        .then(() => {
          mockSubstream.emit('end')
          sinon.assert.calledOnce(process.stdin.end)
          sinon.assert.calledOnce(mockSocket.end)
        })
    })

    it('should setup stdin correctly', () => {
      return assert.isFulfilled(SSH._connectToContainerStream(mockArgs, mockInstance))
        .then(() => {
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

    describe('when stdin is not tty', () => {
      const prevTTY = process.stdin.isTTY
      beforeEach(() => {
        process.stdin.isTTY = false
      })

      afterEach(() => {
        process.stdin.isTTY = prevTTY
      })

      it('should not set raw mode', () => {
        return assert.isFulfilled(SSH._connectToContainerStream(mockArgs, mockInstance))
          .then(() => {
            sinon.assert.notCalled(process.stdin.setRawMode)
          })
      })
    })

    it('should pipe the terminal stream to stdout', () => {
      return assert.isFulfilled(SSH._connectToContainerStream(mockArgs, mockInstance))
        .then(() => {
          sinon.assert.calledOnce(mockSubstream.pipe)
          sinon.assert.calledWithExactly(
            mockSubstream.pipe,
            process.stdout
          )
        })
    })

    it('should write to the socket to start the substream', () => {
      return assert.isFulfilled(SSH._connectToContainerStream(mockArgs, mockInstance))
        .then(() => {
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
