'use strict'

var EventEmitter = require('events')
if (/^v0\.1\d\.\d\d$/.test(process.version)) {
  EventEmitter = require('events').EventEmitter
}
var chai = require('chai')
var simpleGit = require('simple-git/src/git')
var sinon = require('sinon')

require('sinon-as-promised')(require('bluebird'))
chai.use(require('chai-as-promised'))
var assert = chai.assert

var utils = require('../../lib/utils')

describe('Utils', function () {
  describe('getRepositoryAndInstance', function () {
    var mockArgs
    var mockInstance = { _id: 'mockInstanceId' }

    beforeEach(function () {
      mockArgs = {}
      sinon.stub(utils, 'getRepositoryForCurrentDirectory').resolves('mockRepository/branch')
      sinon.stub(utils, 'fetchInstanceForRepository').resolves(mockInstance)
    })

    afterEach(function () {
      utils.getRepositoryForCurrentDirectory.restore()
      utils.fetchInstanceForRepository.restore()
    })

    describe('with no repository', function () {
      it('should get the repository from the current directory', function () {
        return assert.isFulfilled(utils.getRepositoryAndInstance(mockArgs))
          .then(function () {
            sinon.assert.calledOnce(utils.getRepositoryForCurrentDirectory)
          })
      })

      it('should fetch the instance for the current directory', function () {
        return assert.isFulfilled(utils.getRepositoryAndInstance(mockArgs))
          .then(function () {
            sinon.assert.calledOnce(utils.fetchInstanceForRepository)
            sinon.assert.calledWithExactly(
              utils.fetchInstanceForRepository,
              { repository: 'mockRepository/branch' }
            )
          })
      })

      it('should throw if it cannot find the instance', function () {
        utils.fetchInstanceForRepository.resolves()
        return assert.isRejected(
          utils.getRepositoryAndInstance(mockArgs),
          Error,
          /Could not find Container./
        )
      })

      it('should resolve the new args and instance', function () {
        return assert.isFulfilled(utils.getRepositoryAndInstance(mockArgs))
          .then(function (results) {
            assert.deepEqual(
              results,
              [ { repository: 'mockRepository/branch' }, mockInstance ]
            )
          })
      })
    })

    describe('with repository', function () {
      beforeEach(function () {
        mockArgs.repository = 'mockRepository/other-branch'
      })

      it('should not get the current repository', function () {
        return assert.isFulfilled(utils.getRepositoryAndInstance(mockArgs))
          .then(function () {
            sinon.assert.notCalled(utils.getRepositoryForCurrentDirectory)
          })
      })

      it('should fetch the instance for the given repository', function () {
        return assert.isFulfilled(utils.getRepositoryAndInstance(mockArgs))
          .then(function () {
            sinon.assert.calledOnce(utils.fetchInstanceForRepository)
            sinon.assert.calledWithExactly(
              utils.fetchInstanceForRepository,
              { repository: 'mockRepository/other-branch' }
            )
          })
      })

      it('should throw if it cannot find the instance', function () {
        utils.fetchInstanceForRepository.resolves()
        return assert.isRejected(
          utils.getRepositoryAndInstance(mockArgs),
          Error,
          /Could not find Container./
        )
      })

      it('should resolve the new args and instance', function () {
        return assert.isFulfilled(utils.getRepositoryAndInstance(mockArgs))
          .then(function (results) {
            assert.deepEqual(
              results,
              [ { repository: 'mockRepository/other-branch' }, mockInstance ]
            )
          })
      })
    })
  })

  describe('createSocket', function () {
    var mockArgs
    var mockUser
    var mockSocket

    beforeEach(function () {
      mockSocket = new EventEmitter()
      mockSocket.end = sinon.stub()
      mockSocket.write = sinon.stub()
      sinon.spy(mockSocket, 'on')
      mockUser = {
        client: {
          opts: {
            jar: {
              getCookieString: sinon.stub().returns('mockCookieString')
            }
          }
        },
        host: 'mockHost',
        createSocket: sinon.stub().returns(mockSocket)
      }
      mockArgs = { _user: mockUser }
    })

    it('should get the cookie string from the client', function () {
      utils.createSocket(mockArgs)
      sinon.assert.calledOnce(mockUser.client.opts.jar.getCookieString)
      sinon.assert.calledWithExactly(
        mockUser.client.opts.jar.getCookieString,
        'mockHost'
      )
    })

    it('should create a socket with appropriate parameters', function () {
      utils.createSocket(mockArgs)
      sinon.assert.calledOnce(mockUser.createSocket)
      sinon.assert.calledWithExactly(
        mockUser.createSocket,
        {
          transformer: 'websockets',
          parser: 'JSON',
          plugin: sinon.match.has('substream'),
          transport: {
            headers: { cookie: 'mockCookieString' }
          }
        }
      )
    })

    it('should add a data handler for the socket', function () {
      utils.createSocket(mockArgs)
      sinon.assert.calledTwice(mockSocket.on)
      sinon.assert.calledWithExactly(
        mockSocket.on.firstCall,
        'data',
        sinon.match.func
      )
    })

    it('should add a error handler for the socket', function () {
      utils.createSocket(mockArgs)
      sinon.assert.calledTwice(mockSocket.on)
      sinon.assert.calledWithExactly(
        mockSocket.on.secondCall,
        'error',
        sinon.match.func
      )
    })

    it('should log any error message in data', function () {
      sinon.stub(console, 'error')
      var s = utils.createSocket(mockArgs)
      s.emit('data', { error: 'robot' })
      sinon.assert.calledOnce(console.error)
      sinon.assert.calledWithExactly(console.error, 'robot')
      console.error.restore()
    })

    it('should not log any data without error', function () {
      sinon.stub(console, 'error')
      var s = utils.createSocket(mockArgs)
      s.emit('data', { log: 'robot' })
      sinon.assert.notCalled(console.error)
      console.error.restore()
    })

    it('should log any error events', function () {
      sinon.stub(console, 'error')
      var s = utils.createSocket(mockArgs)
      var error = new Error('robot')
      s.emit('error', error)
      sinon.assert.calledOnce(console.error)
      sinon.assert.calledWithExactly(console.error, error)
      console.error.restore()
    })

    it('should return a the new socket', function () {
      var s = utils.createSocket(mockArgs)
      assert.deepEqual(s, mockSocket)
    })
  })

  describe('getRepositoryForCurrentDirectory', function () {
    beforeEach(function () {
      sinon.stub(simpleGit.prototype, 'revparse').yieldsAsync(null, 'some-branch\n')
      sinon.stub(simpleGit.prototype, 'getRemotes').yieldsAsync(null, [
        { name: 'origin', refs: { push: 'git@github.com:Runnable/foo.git' } },
        { name: 'copy', refs: { push: 'git@github.com:Runnable/zap.git' } }
      ])
    })

    afterEach(function () {
      simpleGit.prototype.revparse.restore()
      simpleGit.prototype.getRemotes.restore()
    })

    describe('errors', function () {
      it('should reject with any get remotes errors', function () {
        var error = new Error('robot')
        simpleGit.prototype.getRemotes.yieldsAsync(error)
        return assert.isRejected(
          utils.getRepositoryForCurrentDirectory(),
          Error,
          /robot/
        )
      })

      it('should reject with any get rev errors', function () {
        var error = new Error('robot')
        simpleGit.prototype.revparse.yieldsAsync(error)
        return assert.isRejected(
          utils.getRepositoryForCurrentDirectory(),
          Error,
          /robot/
        )
      })

      it('should throw an error if there is not origin remote', function () {
        simpleGit.prototype.getRemotes.yieldsAsync(null, [{
          name: 'not-origin',
          refs: { push: 'git@github.com:Runnable/foo.git' }
        }])
        return assert.isRejected(
          utils.getRepositoryForCurrentDirectory(),
          Error,
          /remote.*repo.*origin/
        )
      })

      it('should throw a custom error if there is no git repo when fetching getRemotes', function () {
        var error = new Error('fatal: Not a git repository - Yup')
        simpleGit.prototype.getRemotes.yieldsAsync(error)
        return assert.isRejected(
          utils.getRepositoryForCurrentDirectory(),
          Error,
          /Current directory is/
        )
      })

      it('should throw a custom error if there is no git repo when running revparse', function () {
        var error = new Error('fatal: Not a git repository - Yup')
        simpleGit.prototype.revparse.yieldsAsync(error)
        return assert.isRejected(
          utils.getRepositoryForCurrentDirectory(),
          Error,
          /Current directory is/
        )
      })
    })

    it('should get the local remotes', function () {
      return assert.isFulfilled(utils.getRepositoryForCurrentDirectory())
        .then(function () {
          sinon.assert.calledOnce(simpleGit.prototype.getRemotes)
          sinon.assert.calledWithExactly(
            simpleGit.prototype.getRemotes,
            true,
            sinon.match.func
          )
        })
    })

    it('should get the local branch ref', function () {
      return assert.isFulfilled(utils.getRepositoryForCurrentDirectory())
        .then(function () {
          sinon.assert.calledOnce(simpleGit.prototype.revparse)
          sinon.assert.calledWithExactly(
            simpleGit.prototype.revparse,
            [ '--abbrev-ref', 'HEAD' ],
            sinon.match.func
          )
        })
    })

    it('should resolve with the repository', function () {
      return assert.isFulfilled(utils.getRepositoryForCurrentDirectory())
        .then(function (repository) {
          assert.equal(repository, 'foo/some-branch')
        })
    })
  })

  describe('fetchInstanceForRepository', function () {
    var mockArgs
    var mockUser
    var mockInstances
    var mockInstanceOne
    var mockInstanceTwo = {
      contextVersion: {
        appCodeVersions: [{
          defaultBranch: 'master',
          lowerBranch: 'bar'
        }]
      }
    }

    beforeEach(function () {
      mockInstanceOne = {
        contextVersion: {
          appCodeVersions: [{
            defaultBranch: 'master',
            lowerBranch: 'master'
          }]
        }
      }
      mockInstances = [ mockInstanceOne, mockInstanceTwo ]
      mockUser = {
        fetchInstances: sinon.stub().yieldsAsync(null, mockInstances),
        _org: 'foobar'
      }
      // fetchInstances will do two things. first it returns instances matching
      // a repo, second it returns instances matching a name.
      mockUser.fetchInstances.onFirstCall().yieldsAsync(null, mockInstances)
      mockUser.fetchInstances.onSecondCall().yieldsAsync(null, [])
      mockArgs = {
        _user: mockUser,
        repository: 'foo'
      }
    })

    it('should fetch instances for the repository', function () {
      return assert.isFulfilled(utils.fetchInstanceForRepository(mockArgs))
        .then(function () {
          sinon.assert.calledOnce(mockUser.fetchInstances)
          sinon.assert.calledWithExactly(
            mockUser.fetchInstances,
            {
              githubUsername: 'foobar',
              'contextVersion.appCodeVersions.repo': 'foobar/foo'
            },
            sinon.match.func
          )
        })
    })

    describe('when a repo was defined that does not exist', function () {
      beforeEach(function (done) {
        mockUser.fetchInstances.onFirstCall().yieldsAsync(null, [])
        done()
      })

      it('should check to see if it a non-repo container', function (done) {
        return assert.isFulfilled(utils.fetchInstanceForRepository(mockArgs))
          .then(function () {
            sinon.assert.calledTwice(mockUser.fetchInstances)
            sinon.assert.calledWithExactly(
              mockUser.fetchInstances.secondCall,
              {
                githubUsername: 'foobar',
                name: 'foo'
              },
              sinon.match.func
            )
            done()
          })
      })

      describe('when a non-repo container exists that matches', function () {
        var mockMatchingInstance = { name: 'foo' }

        beforeEach(function (done) {
          mockUser.fetchInstances.onSecondCall().yieldsAsync(null, [ mockMatchingInstance ])
          done()
        })

        it('should return the non-repo container', function (done) {
          return assert.isFulfilled(utils.fetchInstanceForRepository(mockArgs))
            .then(function (instance) {
              assert.equal(instance, mockMatchingInstance)
              done()
            })
        })
      })
    })

    describe('when a branch was defined', function () {
      it('should not select a branch with no defaultBranch', function () {
        mockInstanceOne.contextVersion.appCodeVersions[0].defaultBranch = null
        return assert.isFulfilled(utils.fetchInstanceForRepository(mockArgs))
          .then(function (instance) {
            assert.notOk(instance)
          })
      })

      it('should connect to the instance that matches that branch', function () {
        mockArgs.repository = 'foo/bar'
        return assert.isFulfilled(utils.fetchInstanceForRepository(mockArgs))
          .then(function (instance) {
            assert.deepEqual(instance, mockInstanceTwo)
          })
      })
    })

    describe('when a branch was not defined', function () {
      it('should return the default instance', function () {
        return assert.isFulfilled(utils.fetchInstanceForRepository(mockArgs))
          .then(function (instance) {
            assert.equal(instance, mockInstanceOne)
          })
      })
    })
  })

  describe('handleError', function () {
    beforeEach(function (done) {
      sinon.stub(console, 'error')
      done()
    })

    afterEach(function (done) {
      console.error.restore()
      done()
    })

    it('should log error messages', function (done) {
      var myError = new Error('Test Error')
      utils.handleError(myError)
      sinon.assert.calledOnce(console.error)
      sinon.assert.calledWithMatch(console.error, /Error/, /Test Error/)
      done()
    })
  })
})
