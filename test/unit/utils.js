'use strict'

const EventEmitter = require('events')
const chai = require('chai')
const simpleGit = require('simple-git/src/git')
const sinon = require('sinon')

require('sinon-as-promised')(require('bluebird'))
chai.use(require('chai-as-promised'))
const assert = chai.assert

const Utils = require('../../lib/utils')

describe('Utils', () => {
  describe('getRepositoryAndInstance', () => {
    let mockArgs
    const mockInstance = { _id: 'mockInstanceId' }

    beforeEach(() => {
      mockArgs = {}
      sinon.stub(Utils, 'getRepositoryForCurrentDirectory').resolves('mockRepository/branch')
      sinon.stub(Utils, 'fetchInstanceForRepository').resolves(mockInstance)
    })

    afterEach(() => {
      Utils.getRepositoryForCurrentDirectory.restore()
      Utils.fetchInstanceForRepository.restore()
    })

    describe('with no repository', () => {
      it('should get the repository from the current directory', () => {
        return assert.isFulfilled(Utils.getRepositoryAndInstance(mockArgs))
          .then(() => {
            sinon.assert.calledOnce(Utils.getRepositoryForCurrentDirectory)
          })
      })

      it('should fetch the instance for the current directory', () => {
        return assert.isFulfilled(Utils.getRepositoryAndInstance(mockArgs))
          .then(() => {
            sinon.assert.calledOnce(Utils.fetchInstanceForRepository)
            sinon.assert.calledWithExactly(
              Utils.fetchInstanceForRepository,
              { repository: 'mockRepository/branch' }
            )
          })
      })

      it('should throw if it cannot find the instance', () => {
        Utils.fetchInstanceForRepository.resolves()
        return assert.isRejected(
          Utils.getRepositoryAndInstance(mockArgs),
          Error,
          /Could not find Container./
        )
      })

      it('should resolve the new args and instance', () => {
        return assert.isFulfilled(Utils.getRepositoryAndInstance(mockArgs))
          .then((results) => {
            assert.deepEqual(
              results,
              [ { repository: 'mockRepository/branch' }, mockInstance ]
            )
          })
      })
    })

    describe('with repository', () => {
      beforeEach(() => {
        mockArgs.repository = 'mockRepository/other-branch'
      })

      it('should not get the current repository', () => {
        return assert.isFulfilled(Utils.getRepositoryAndInstance(mockArgs))
          .then(() => {
            sinon.assert.notCalled(Utils.getRepositoryForCurrentDirectory)
          })
      })

      it('should fetch the instance for the given repository', () => {
        return assert.isFulfilled(Utils.getRepositoryAndInstance(mockArgs))
          .then(() => {
            sinon.assert.calledOnce(Utils.fetchInstanceForRepository)
            sinon.assert.calledWithExactly(
              Utils.fetchInstanceForRepository,
              { repository: 'mockRepository/other-branch' }
            )
          })
      })

      it('should throw if it cannot find the instance', () => {
        Utils.fetchInstanceForRepository.resolves()
        return assert.isRejected(
          Utils.getRepositoryAndInstance(mockArgs),
          Error,
          /Could not find Container./
        )
      })

      it('should resolve the new args and instance', () => {
        return assert.isFulfilled(Utils.getRepositoryAndInstance(mockArgs))
          .then((results) => {
            assert.deepEqual(
              results,
              [ { repository: 'mockRepository/other-branch' }, mockInstance ]
            )
          })
      })
    })
  })

  describe('createSocket', () => {
    let mockArgs
    let mockUser
    let mockSocket

    beforeEach(() => {
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
      Utils.user = mockUser
      mockArgs = { _user: mockUser }
    })

    it('should get the cookie string from the client', () => {
      Utils.createSocket(mockArgs)
      sinon.assert.calledOnce(mockUser.client.opts.jar.getCookieString)
      sinon.assert.calledWithExactly(
        mockUser.client.opts.jar.getCookieString,
        'mockHost'
      )
    })

    it('should create a socket with appropriate parameters', () => {
      Utils.createSocket(mockArgs)
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

    it('should add a data handler for the socket', () => {
      Utils.createSocket(mockArgs)
      sinon.assert.calledTwice(mockSocket.on)
      sinon.assert.calledWithExactly(
        mockSocket.on.firstCall,
        'data',
        sinon.match.func
      )
    })

    it('should add a error handler for the socket', () => {
      Utils.createSocket(mockArgs)
      sinon.assert.calledTwice(mockSocket.on)
      sinon.assert.calledWithExactly(
        mockSocket.on.secondCall,
        'error',
        sinon.match.func
      )
    })

    it('should log any error message in data', () => {
      sinon.stub(console, 'error')
      const s = Utils.createSocket(mockArgs)
      s.emit('data', { error: 'robot' })
      sinon.assert.calledOnce(console.error)
      sinon.assert.calledWithExactly(console.error, 'robot')
      console.error.restore()
    })

    it('should not log any data without error', () => {
      sinon.stub(console, 'error')
      const s = Utils.createSocket(mockArgs)
      s.emit('data', { log: 'robot' })
      sinon.assert.notCalled(console.error)
      console.error.restore()
    })

    it('should log any error events', () => {
      sinon.stub(console, 'error')
      const s = Utils.createSocket(mockArgs)
      const error = new Error('robot')
      s.emit('error', error)
      sinon.assert.calledOnce(console.error)
      sinon.assert.calledWithExactly(console.error, error)
      console.error.restore()
    })

    it('should return a the new socket', () => {
      const s = Utils.createSocket(mockArgs)
      assert.deepEqual(s, mockSocket)
    })
  })

  describe('getRepositoryForCurrentDirectory', () => {
    beforeEach(() => {
      sinon.stub(simpleGit.prototype, 'revparse').yieldsAsync(null, 'some-branch\n')
      sinon.stub(simpleGit.prototype, 'getRemotes').yieldsAsync(null, [
        { name: 'origin', refs: { push: 'git@github.com:Runnable/foo.git' } },
        { name: 'copy', refs: { push: 'git@github.com:Runnable/zap.git' } }
      ])
    })

    afterEach(() => {
      simpleGit.prototype.revparse.restore()
      simpleGit.prototype.getRemotes.restore()
    })

    describe('errors', () => {
      it('should reject with any get remotes errors', () => {
        const error = new Error('robot')
        simpleGit.prototype.getRemotes.yieldsAsync(error)
        return assert.isRejected(
          Utils.getRepositoryForCurrentDirectory(),
          Error,
          /robot/
        )
      })

      it('should reject with any get rev errors', () => {
        const error = new Error('robot')
        simpleGit.prototype.revparse.yieldsAsync(error)
        return assert.isRejected(
          Utils.getRepositoryForCurrentDirectory(),
          Error,
          /robot/
        )
      })

      it('should throw an error if there is not "origin" remote', function () {
        simpleGit.prototype.getRemotes.yieldsAsync(null, [{
          name: 'not-origin',
          refs: { push: 'git@github.com:Runnable/foo.git' }
        }])
        return assert.isRejected(
          Utils.getRepositoryForCurrentDirectory(),
          Error,
          /no remote repo.+origin/i
        )
      })
    })

    it('should get the local remotes', () => {
      return assert.isFulfilled(Utils.getRepositoryForCurrentDirectory())
        .then(() => {
          sinon.assert.calledOnce(simpleGit.prototype.getRemotes)
          sinon.assert.calledWithExactly(
            simpleGit.prototype.getRemotes,
            true,
            sinon.match.func
          )
        })
    })

    it('should get the local branch ref', () => {
      return assert.isFulfilled(Utils.getRepositoryForCurrentDirectory())
        .then(() => {
          sinon.assert.calledOnce(simpleGit.prototype.revparse)
          sinon.assert.calledWithExactly(
            simpleGit.prototype.revparse,
            [ '--abbrev-ref', 'HEAD' ],
            sinon.match.func
          )
        })
    })

    it('should resolve with the repository', () => {
      return assert.isFulfilled(Utils.getRepositoryForCurrentDirectory())
        .then((repository) => {
          assert.equal(repository, 'foo/some-branch')
        })
    })
  })

  describe('fetchInstanceForRepository', () => {
    let mockArgs
    let mockUser
    let mockInstances
    let mockInstanceOne
    const mockInstanceTwo = {
      contextVersion: {
        appCodeVersions: [{
          defaultBranch: 'master',
          lowerBranch: 'bar'
        }]
      }
    }

    beforeEach(() => {
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
      Utils.user = mockUser
      // fetchInstances will do two things. first it returns instances matching
      // a repo, second it returns instances matching a name.
      mockUser.fetchInstances.onFirstCall().yieldsAsync(null, mockInstances)
      mockUser.fetchInstances.onSecondCall().yieldsAsync(null, [])
      mockArgs = {
        _user: mockUser,
        repository: 'foo'
      }
    })

    it('should fetch instances for the repository', () => {
      return assert.isFulfilled(Utils.fetchInstanceForRepository(mockArgs))
        .then(() => {
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

    describe('when a repo was defined that does not exist', () => {
      beforeEach(() => {
        mockUser.fetchInstances.onFirstCall().yieldsAsync(null, [])
      })

      it('should check to see if it a non-repo container', (done) => {
        return assert.isFulfilled(Utils.fetchInstanceForRepository(mockArgs))
          .then(() => {
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

      describe('when a non-repo container exists that matches', () => {
        const mockMatchingInstance = { name: 'foo' }

        beforeEach(() => {
          mockUser.fetchInstances.onSecondCall().yieldsAsync(null, [ mockMatchingInstance ])
        })

        it('should return the non-repo container', (done) => {
          return assert.isFulfilled(Utils.fetchInstanceForRepository(mockArgs))
            .then((instance) => {
              assert.equal(instance, mockMatchingInstance)
              done()
            })
        })
      })
    })

    describe('when a branch was defined', () => {
      it('should not select a branch with no defaultBranch', () => {
        mockInstanceOne.contextVersion.appCodeVersions[0].defaultBranch = null
        return assert.isFulfilled(Utils.fetchInstanceForRepository(mockArgs))
          .then((instance) => {
            assert.notOk(instance)
          })
      })

      it('should connect to the instance that matches that branch', () => {
        mockArgs.repository = 'foo/bar'
        return assert.isFulfilled(Utils.fetchInstanceForRepository(mockArgs))
          .then((instance) => {
            assert.deepEqual(instance, mockInstanceTwo)
          })
      })
    })

    describe('when a branch was not defined', () => {
      it('should return the default instance', () => {
        return assert.isFulfilled(Utils.fetchInstanceForRepository(mockArgs))
          .then((instance) => {
            assert.equal(instance, mockInstanceOne)
          })
      })
    })
  })
})
