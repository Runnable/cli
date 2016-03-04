'use strict'

const EventEmitter = require('events')
const chai = require('chai')
const sinon = require('sinon')

require('sinon-as-promised')(require('bluebird'))
chai.use(require('chai-as-promised'))
const assert = chai.assert

const Utils = require('../../lib/utils')
const Logs = require('../../lib/logs')

describe('Logs Methods', () => {
  let mockArgs
  let mockInstance
  let mockSocket
  let mockSubstream

  describe('connectContainerLogs', () => {
    beforeEach(() => {
      mockArgs = {}
      sinon.stub(Utils, 'getRepositoryAndInstance').resolves([ mockArgs, mockInstance ])
      sinon.stub(Logs, '_connectToContainerLogs').resolves()
      sinon.stub(Logs, '_connectToContainerBuildLogs').resolves()
    })

    afterEach(() => {
      Utils.getRepositoryAndInstance.restore()
      Logs._connectToContainerLogs.restore()
      Logs._connectToContainerBuildLogs.restore()
    })

    describe('errors', () => {
      it('should reject with any getRepositoryAndInstance error', () => {
        Utils.getRepositoryAndInstance.rejects(new Error('robot'))
        return assert.isRejected(
          Logs.connectContainerLogs(mockArgs),
          Error,
          'robot'
        )
      })

      describe('looking for build logs', () => {
        beforeEach(() => {
          mockArgs.cmd = undefined
          mockArgs.build = true
        })

        it('should reject with any _connectToContainerBuildLogs error', () => {
          Logs._connectToContainerBuildLogs.rejects(new Error('doobie'))
          return assert.isRejected(
            Logs.connectContainerLogs(mockArgs),
            Error,
            'doobie'
          )
        })
      })

      describe('looking for command logs', () => {
        beforeEach(() => {
          mockArgs.build = undefined
          mockArgs.cmd = true
        })

        it('should reject with any _connectToContainerLogs error', () => {
          Logs._connectToContainerLogs.rejects(new Error('luna'))
          return assert.isRejected(
            Logs.connectContainerLogs(mockArgs),
            Error,
            'luna'
          )
        })
      })

      describe('if no option for build or cmd was defined', () => {
        beforeEach(() => {
          mockArgs.build = undefined
          mockArgs.cmd = undefined
        })

        it('should reject, since we have no code path for this', () => {
          return assert.isRejected(
            Logs.connectContainerLogs(mockArgs),
            Error,
            'not sure what logs to connect'
          )
        })
      })
    })

    it('should get the repository and instance', () => {
      mockArgs.cmd = true
      mockArgs.build = undefined
      return assert.isFulfilled(Logs.connectContainerLogs(mockArgs))
        .then(() => {
          sinon.assert.calledOnce(Utils.getRepositoryAndInstance)
          sinon.assert.calledWithExactly(
            Utils.getRepositoryAndInstance,
            mockArgs
          )
        })
    })

    describe('when looking for build logs', () => {
      beforeEach(() => {
        mockArgs.build = true
        mockArgs.cmd = undefined
      })

      it('should connect to build logs', () => {
        return assert.isFulfilled(Logs.connectContainerLogs(mockArgs))
          .then(() => {
            sinon.assert.calledOnce(Logs._connectToContainerBuildLogs)
            sinon.assert.calledWithExactly(
              Logs._connectToContainerBuildLogs,
              mockArgs,
              mockInstance
            )
          })
      })
    })

    describe('when looking for cmd logs', () => {
      beforeEach(() => {
        mockArgs.cmd = true
        mockArgs.build = undefined
      })

      it('should connect to cmd logs', () => {
        return assert.isFulfilled(Logs.connectContainerLogs(mockArgs))
          .then(() => {
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

  describe('_connectToContainerBuildLogs', () => {
    let mockSocket
    let mockSubstream

    beforeEach(() => {
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
      sinon.stub(Utils, 'createSocket').returns(mockSocket)
    })

    afterEach(() => {
      Utils.createSocket.restore()
    })

    it('should create a substream using the context version ID', () => {
      return assert.isFulfilled(Logs._connectToContainerBuildLogs(mockArgs, mockInstance))
        .then(() => {
          sinon.assert.calledOnce(mockSocket.substream)
          sinon.assert.calledWithExactly(
            mockSocket.substream,
            sinon.match.string
          )
          assert.match(mockSocket.substream.args[0][0], /^mockContextVersionId\-.+$/)
        })
    })

    it('should write the event to create the log stream', () => {
      return assert.isFulfilled(Logs._connectToContainerBuildLogs(mockArgs, mockInstance))
        .then(() => {
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

    it('should log any error from the logs strem', () => {
      sinon.stub(console, 'error')
      return assert.isFulfilled(Logs._connectToContainerBuildLogs(mockArgs, mockInstance))
        .then(() => {
          const error = new Error('robot')
          mockSubstream.emit('error', error)
          sinon.assert.calledOnce(console.error)
          sinon.assert.calledWithExactly(console.error, error)
        })
        .finally(() => { console.error.restore() })
    })

    it('should not output any socket data events', () => {
      sinon.stub(console, 'log')
      mockSocket.write = () => {
        mockSocket.emit('data', 'foobar')
      }
      return assert.isFulfilled(Logs._connectToContainerBuildLogs(mockArgs, mockInstance))
        .then(() => {
          sinon.assert.notCalled(console.log)
        })
        .finally(() => { console.log.restore() })
    })

    it('should close the socket when the log stream ends', () => {
      mockSocket.write = () => {
        mockSubstream.emit('end')
      }
      return assert.isFulfilled(Logs._connectToContainerBuildLogs(mockArgs, mockInstance))
        .then(() => {
          sinon.assert.calledOnce(mockSocket.end)
        })
    })

    describe('output', () => {
      beforeEach(() => {
        sinon.stub(process.stdout, 'write')
      })

      afterEach(() => {
        process.stdout.write.restore()
      })

      it('should write basic data to process.stdout', () => {
        return assert.isFulfilled(Logs._connectToContainerBuildLogs(mockArgs, mockInstance))
          .then(() => {
            mockSubstream.emit('data', { type: 'log', content: 'stuff' })
            sinon.assert.calledOnce(process.stdout.write)
            sinon.assert.calledWithExactly(process.stdout.write, 'stuff')
          })
      })

      it('should write docker logs', () => {
        return assert.isFulfilled(Logs._connectToContainerBuildLogs(mockArgs, mockInstance))
          .then(() => {
            mockSubstream.emit('data', { type: 'docker', content: 'Step' })
            sinon.assert.calledOnce(process.stdout.write)
            sinon.assert.calledWithExactly(process.stdout.write, 'Step')
          })
      })

      it('should not write basic logs that are not logs', () => {
        return assert.isFulfilled(Logs._connectToContainerBuildLogs(mockArgs, mockInstance))
          .then(() => {
            mockSubstream.emit('data', { type: 'not-log', content: 'stuff' })
            sinon.assert.notCalled(process.stdout.write)
          })
      })

      it('should write basic array data to process.stdout', () => {
        return assert.isFulfilled(Logs._connectToContainerBuildLogs(mockArgs, mockInstance))
          .then(() => {
            mockSubstream.emit('data', [
              { type: 'log', content: 'stuff' },
              { type: 'log', content: 'stuff' }
            ])
            sinon.assert.calledTwice(process.stdout.write)
            sinon.assert.calledWithExactly(process.stdout.write, 'stuff')
          })
      })

      it('should skip array values that are not logs', () => {
        return assert.isFulfilled(Logs._connectToContainerBuildLogs(mockArgs, mockInstance))
          .then(() => {
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

  describe('_connectToContainerLogs', () => {
    beforeEach(() => {
      mockSubstream = new EventEmitter()
      mockSubstream.pipe = sinon.stub().returns(mockSubstream)
      mockSocket = new EventEmitter()
      mockSocket.end = sinon.stub()
      mockSocket.substream = sinon.stub().returns(mockSubstream)
      mockSocket.write = sinon.stub()
      mockArgs = { cmd: true }
      mockInstance = {
        container: {
          dockerContainer: 'mockContainerId'
        }
      }
      sinon.stub(Utils, 'createSocket').returns(mockSocket)
    })

    afterEach(() => {
      Utils.createSocket.restore()
    })

    it('should create a substream using the container ID', () => {
      return assert.isFulfilled(Logs._connectToContainerLogs(mockArgs, mockInstance))
        .then(() => {
          sinon.assert.calledOnce(mockSocket.substream)
          sinon.assert.calledWithExactly(
            mockSocket.substream,
            'mockContainerId'
          )
        })
    })

    it('should write the event to create the log stream', () => {
      return assert.isFulfilled(Logs._connectToContainerLogs(mockArgs, mockInstance))
        .then(() => {
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

    it('should pipe output to process.stdout', () => {
      return assert.isFulfilled(Logs._connectToContainerLogs(mockArgs, mockInstance))
        .then(() => {
          sinon.assert.calledTwice(mockSubstream.pipe)
          sinon.assert.calledWithExactly(
            mockSubstream.pipe,
            process.stdout
          )
        })
    })

    it('should not output any socket data events', () => {
      sinon.stub(console, 'log')
      mockSocket.write = () => {
        mockSocket.emit('data', 'foobar')
      }
      return assert.isFulfilled(Logs._connectToContainerLogs(mockArgs, mockInstance))
        .then(() => {
          sinon.assert.notCalled(console.log)
        })
        .finally(() => { console.log.restore() })
    })

    it('should close the socket when the log stream ends', () => {
      mockSocket.write = () => {
        mockSubstream.emit('end')
      }
      return assert.isFulfilled(Logs._connectToContainerLogs(mockArgs, mockInstance))
        .then(() => {
          sinon.assert.calledOnce(mockSocket.end)
        })
    })
  })
})
