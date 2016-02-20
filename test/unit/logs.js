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
var Logs = require('../../lib/logs')

describe('Logs Methods', function () {
  var mockArgs
  var mockInstance
  var mockSocket
  var mockSubstream

  describe('connectContainerLogs', function () {
    beforeEach(function () {
      mockArgs = {}
      sinon.stub(utils, 'getRepositoryAndInstance').resolves([ mockArgs, mockInstance ])
      sinon.stub(Logs, '_connectToContainerLogs').resolves()
      sinon.stub(Logs, '_connectToContainerBuildLogs').resolves()
    })

    afterEach(function () {
      utils.getRepositoryAndInstance.restore()
      Logs._connectToContainerLogs.restore()
      Logs._connectToContainerBuildLogs.restore()
    })

    describe('errors', function () {
      it('should reject with any getRepositoryAndInstance error', function () {
        utils.getRepositoryAndInstance.rejects(new Error('robot'))
        return assert.isRejected(
          Logs.connectContainerLogs(mockArgs),
          Error,
          'robot'
        )
      })

      describe('looking for build logs', function () {
        beforeEach(function () {
          mockArgs.cmd = undefined
          mockArgs.build = true
        })

        it('should reject with any _connectToContainerBuildLogs error', function () {
          Logs._connectToContainerBuildLogs.rejects(new Error('doobie'))
          return assert.isRejected(
            Logs.connectContainerLogs(mockArgs),
            Error,
            'doobie'
          )
        })
      })

      describe('looking for command logs', function () {
        beforeEach(function () {
          mockArgs.build = undefined
          mockArgs.cmd = true
        })

        it('should reject with any _connectToContainerLogs error', function () {
          Logs._connectToContainerLogs.rejects(new Error('luna'))
          return assert.isRejected(
            Logs.connectContainerLogs(mockArgs),
            Error,
            'luna'
          )
        })
      })

      describe('if no option for build or cmd was defined', function () {
        beforeEach(function () {
          mockArgs.build = undefined
          mockArgs.cmd = undefined
        })

        it('should reject, since we have no code path for this', function () {
          return assert.isRejected(
            Logs.connectContainerLogs(mockArgs),
            Error,
            'not sure what logs to connect'
          )
        })
      })
    })

    it('should get the repository and instance', function () {
      mockArgs.cmd = true
      mockArgs.build = undefined
      return assert.isFulfilled(Logs.connectContainerLogs(mockArgs))
        .then(function () {
          sinon.assert.calledOnce(utils.getRepositoryAndInstance)
          sinon.assert.calledWithExactly(
            utils.getRepositoryAndInstance,
            mockArgs
          )
        })
    })

    describe('when looking for build logs', function () {
      beforeEach(function () {
        mockArgs.build = true
        mockArgs.cmd = undefined
      })

      it('should connect to build logs', function () {
        return assert.isFulfilled(Logs.connectContainerLogs(mockArgs))
          .then(function () {
            sinon.assert.calledOnce(Logs._connectToContainerBuildLogs)
            sinon.assert.calledWithExactly(
              Logs._connectToContainerBuildLogs,
              mockArgs,
              mockInstance
            )
          })
      })
    })

    describe('when looking for cmd logs', function () {
      beforeEach(function () {
        mockArgs.cmd = true
        mockArgs.build = undefined
      })

      it('should connect to cmd logs', function () {
        return assert.isFulfilled(Logs.connectContainerLogs(mockArgs))
          .then(function () {
            sinon.assert.calledOnce(Logs._connectToContainerLogs)
            sinon.assert.calledWithExactly(
              Logs._connectToContainerLogs,
              mockArgs,
              mockInstance
            )
          })
      })
    })
  })

  describe('_connectToContainerBuildLogs', function () {
    var mockSocket
    var mockSubstream

    beforeEach(function () {
      mockSubstream = new EventEmitter()
      mockSubstream.pipe = sinon.stub().returns(mockSubstream)
      mockSocket = new EventEmitter()
      mockSocket.end = sinon.stub()
      mockSocket.substream = sinon.stub().returns(mockSubstream)
      mockSocket.write = sinon.stub()
      mockInstance = {
        contextVersion: {
          _id: 'mockContextVersionId'
        }
      }
      sinon.stub(utils, 'createSocket').returns(mockSocket)
    })

    afterEach(function () {
      utils.createSocket.restore()
    })

    it('should create a substream using the context version ID', function () {
      return assert.isFulfilled(Logs._connectToContainerBuildLogs(mockArgs, mockInstance))
        .then(function () {
          sinon.assert.calledOnce(mockSocket.substream)
          sinon.assert.calledWithExactly(
            mockSocket.substream,
            sinon.match.string
          )
          assert.match(mockSocket.substream.args[0][0], /^mockContextVersionId\-.+$/)
        })
    })

    it('should write the event to create the log stream', function () {
      return assert.isFulfilled(Logs._connectToContainerBuildLogs(mockArgs, mockInstance))
        .then(function () {
          sinon.assert.calledOnce(mockSocket.write)
          sinon.assert.calledWithExactly(
            mockSocket.write,
            {
              id: 1,
              event: 'build-stream',
              data: {
                streamId: sinon.match.string,
                id: 'mockContextVersionId'
              }
            }
          )
        })
    })

    it('should log any error from the logs strem', function () {
      sinon.stub(console, 'error')
      return assert.isFulfilled(Logs._connectToContainerBuildLogs(mockArgs, mockInstance))
        .then(function () {
          var error = new Error('robot')
          mockSubstream.emit('error', error)
          sinon.assert.calledOnce(console.error)
          sinon.assert.calledWithExactly(console.error, error)
        })
        .finally(function () { console.error.restore() })
    })

    it('should not output any socket data events', function () {
      sinon.stub(console, 'log')
      mockSocket.write = function () {
        mockSocket.emit('data', 'foobar')
      }
      return assert.isFulfilled(Logs._connectToContainerBuildLogs(mockArgs, mockInstance))
        .then(function () {
          sinon.assert.notCalled(console.log)
        })
        .finally(function () { console.log.restore() })
    })

    it('should close the socket when the log stream ends', function () {
      mockSocket.write = function () {
        mockSubstream.emit('end')
      }
      return assert.isFulfilled(Logs._connectToContainerBuildLogs(mockArgs, mockInstance))
        .then(function () {
          sinon.assert.calledOnce(mockSocket.end)
        })
    })

    describe('output', function () {
      beforeEach(function () {
        sinon.stub(process.stdout, 'write')
      })

      afterEach(function () {
        process.stdout.write.restore()
      })

      it('should write basic data to process.stdout', function () {
        return assert.isFulfilled(Logs._connectToContainerBuildLogs(mockArgs, mockInstance))
          .then(function () {
            mockSubstream.emit('data', { type: 'log', content: 'stuff' })
            sinon.assert.calledOnce(process.stdout.write)
            sinon.assert.calledWithExactly(process.stdout.write, 'stuff')
          })
      })

      it('should not write basic logs that are not logs', function () {
        return assert.isFulfilled(Logs._connectToContainerBuildLogs(mockArgs, mockInstance))
          .then(function () {
            mockSubstream.emit('data', { type: 'not-log', content: 'stuff' })
            sinon.assert.notCalled(process.stdout.write)
          })
      })

      it('should write basic array data to process.stdout', function () {
        return assert.isFulfilled(Logs._connectToContainerBuildLogs(mockArgs, mockInstance))
          .then(function () {
            mockSubstream.emit('data', [
              { type: 'log', content: 'stuff' },
              { type: 'log', content: 'stuff' }
            ])
            sinon.assert.calledTwice(process.stdout.write)
            sinon.assert.calledWithExactly(process.stdout.write, 'stuff')
          })
      })

      it('should skip array values that are not logs', function () {
        return assert.isFulfilled(Logs._connectToContainerBuildLogs(mockArgs, mockInstance))
          .then(function () {
            mockSubstream.emit('data', [
              { type: 'log', content: 'stuff' },
              { type: 'notlog', content: 'stuff' }
            ])
            sinon.assert.calledOnce(process.stdout.write)
            sinon.assert.calledWithExactly(process.stdout.write, 'stuff')
          })
      })
    })
  })

  describe('_connectToContainerLogs', function () {
    var mockUser

    beforeEach(function () {
      mockSubstream = new EventEmitter()
      mockSubstream.pipe = sinon.stub().returns(mockSubstream)
      mockSocket = new EventEmitter()
      mockSocket.end = sinon.stub()
      mockSocket.substream = sinon.stub().returns(mockSubstream)
      mockSocket.write = sinon.stub()
      mockUser = {}
      mockArgs = {
        _user: mockUser,
        cmd: true
      }
      mockInstance = {
        container: {
          dockerContainer: 'mockContainerId'
        }
      }
      sinon.stub(utils, 'createSocket').returns(mockSocket)
    })

    afterEach(function () {
      utils.createSocket.restore()
    })

    it('should create a substream using the container ID', function () {
      return assert.isFulfilled(Logs._connectToContainerLogs(mockArgs, mockInstance))
        .then(function () {
          sinon.assert.calledOnce(mockSocket.substream)
          sinon.assert.calledWithExactly(
            mockSocket.substream,
            'mockContainerId'
          )
        })
    })

    it('should write the event to create the log stream', function () {
      return assert.isFulfilled(Logs._connectToContainerLogs(mockArgs, mockInstance))
        .then(function () {
          sinon.assert.calledOnce(mockSocket.write)
          sinon.assert.calledWithExactly(
            mockSocket.write,
            {
              id: 1,
              event: 'log-stream',
              data: {
                substreamId: 'mockContainerId',
                dockHost: sinon.match.string,
                containerId: 'mockContainerId'
              }
            }
          )
        })
    })

    it('should pipe output to process.stdout', function () {
      return assert.isFulfilled(Logs._connectToContainerLogs(mockArgs, mockInstance))
        .then(function () {
          sinon.assert.calledTwice(mockSubstream.pipe)
          sinon.assert.calledWithExactly(
            mockSubstream.pipe,
            process.stdout
          )
        })
    })

    it('should not output any socket data events', function () {
      sinon.stub(console, 'log')
      mockSocket.write = function () {
        mockSocket.emit('data', 'foobar')
      }
      return assert.isFulfilled(Logs._connectToContainerLogs(mockArgs, mockInstance))
        .then(function () {
          sinon.assert.notCalled(console.log)
        })
        .finally(function () { console.log.restore() })
    })

    it('should close the socket when the log stream ends', function () {
      mockSocket.write = function () {
        mockSubstream.emit('end')
      }
      return assert.isFulfilled(Logs._connectToContainerLogs(mockArgs, mockInstance))
        .then(function () {
          sinon.assert.calledOnce(mockSocket.end)
        })
    })
  })
})
