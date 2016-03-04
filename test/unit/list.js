'use strict'

const chai = require('chai')
const sinon = require('sinon')

chai.use(require('chai-as-promised'))
const assert = chai.assert

const List = require('../../lib/list')

describe('Container Methods', () => {
  describe('listContainersForRepository', () => {
    let mockArgs
    let mockInstances
    let mockUser

    beforeEach(() => {
      mockArgs = {
        repository: 'foo'
      }
      mockInstances = [{
        lowerName: 'foo',
        contextVersion: { appCodeVersions: [{ lowerRepo: 'bkendall/foo', lowerBranch: 'master' }] },
        container: { inspect: { State: { Status: 'Running' } } },
        shortHash: 'foo00'
      }, {
        lowerName: 'bar-foo',
        contextVersion: { appCodeVersions: [{ lowerRepo: 'bkendall/foo', lowerBranch: 'bar' }] },
        container: { inspect: { State: { Status: 'Running' } } },
        shortHash: 'bar00'
      }]
      mockUser = {
        _org: 'bkendall',
        fetchInstances: sinon.stub().yieldsAsync(null, mockInstances)
      }
      List.user = mockUser
    })

    it('should be a function', () => {
      assert.isFunction(List.listContainersForRepository)
    })

    it('should require repository', () => {
      mockArgs.repository = null
      return assert.isRejected(
        List.listContainersForRepository(mockArgs),
        /repository.+required/i
      )
    })

    it('should fetch instances', () => {
      return assert.isFulfilled(List.listContainersForRepository(mockArgs))
        .then(() => {
          sinon.assert.calledOnce(mockUser.fetchInstances)
          sinon.assert.calledWithExactly(
            mockUser.fetchInstances,
            { githubUsername: 'bkendall' },
            sinon.match.func
          )
        })
    })

    it('should always fetch for the mockUser._org value', () => {
      mockUser._org = 'foobar'
      return assert.isFulfilled(List.listContainersForRepository(mockArgs))
        .then(() => {
          sinon.assert.calledOnce(mockUser.fetchInstances)
          sinon.assert.calledWithExactly(
            mockUser.fetchInstances,
            { githubUsername: 'foobar' },
            sinon.match.func
          )
        })
    })

    it('should resolve with an array', () => {
      return assert.isFulfilled(List.listContainersForRepository(mockArgs))
        .then((result) => {
          assert.isArray(result)
        })
    })

    it('should filter repositories for the specified org', () => {
      mockInstances.push({
        lowerName: 'bar',
        contextVersion: { appCodeVersions: [{ lowerRepo: 'bkendall/bar', lowerBranch: 'master' }] },
        container: { inspect: { State: { Status: 'Running' } } },
        shortHash: 'bar00'
      })
      return assert.isFulfilled(List.listContainersForRepository(mockArgs))
        .then((result) => {
          assert.lengthOf(result, 2)
        })
    })

    it('should ignore non-repo containers', () => {
      mockInstances.push({
        lowerName: 'redis',
        contextVersion: { appCodeVersions: [] },
        container: { inspect: { State: { Status: 'Running' } } },
        shortHash: 'redis00'
      })
      return assert.isFulfilled(List.listContainersForRepository(mockArgs))
        .then((result) => {
          assert.lengthOf(result, 2)
        })
    })

    it('should put a dash for unknown containers', () => {
      mockInstances[0].container = null
      return assert.isFulfilled(List.listContainersForRepository(mockArgs))
        .then((result) => {
          assert.equal(result[0].Status, '-')
        })
    })
  })

  describe('listContainerSummary', () => {
    let mockArgs
    let mockInstances
    let mockUser

    beforeEach(() => {
      mockArgs = {
        repository: 'foo'
      }
      mockInstances = [{
        lowerName: 'foo',
        contextVersion: { appCodeVersions: [{ lowerRepo: 'bkendall/foo', lowerBranch: 'master' }] },
        container: { inspect: { State: { Status: 'Running' } } },
        shortHash: 'foo00'
      }, {
        lowerName: 'bar-foo',
        contextVersion: { appCodeVersions: [{ lowerRepo: 'bkendall/foo', lowerBranch: 'bar' }] },
        container: { inspect: { State: { Status: 'Running' } } },
        shortHash: 'bar00'
      }, {
        lowerName: 'redis',
        contextVersion: { appCodeVersions: [] },
        container: { inspect: { State: { Status: 'Running' } } },
        shortHash: 'redis00'
      }]
      mockUser = {
        _org: 'bkendall',
        fetchInstances: sinon.stub().yieldsAsync(null, mockInstances)
      }
      List.user = mockUser
    })

    it('should fetch user instances', () => {
      return assert.isFulfilled(List.listContainerSummary(mockArgs))
        .then(() => {
          sinon.assert.calledOnce(mockUser.fetchInstances)
          sinon.assert.calledWithExactly(
            mockUser.fetchInstances,
            { githubUsername: 'bkendall' },
            sinon.match.func
          )
        })
    })

    it('should return an object with two array keys', () => {
      return assert.isFulfilled(List.listContainerSummary(mockArgs))
        .then((result) => {
          assert.isObject(result)
          assert.isArray(result.repositories)
          assert.isArray(result.services)
        })
    })

    it('should return a list of repositories and container counts', () => {
      return assert.isFulfilled(List.listContainerSummary(mockArgs))
        .then((result) => {
          assert.include(result.repositories, { Repositories: 'foo', Count: '2 containers' })
        })
    })

    it('should not pluralize repository counts if only one exists', () => {
      mockInstances.splice(1, 1)
      return assert.isFulfilled(List.listContainerSummary(mockArgs))
        .then((result) => {
          assert.include(result.repositories, { Repositories: 'foo', Count: '1 container' })
        })
    })

    it('should return a list of services and container counts', () => {
      return assert.isFulfilled(List.listContainerSummary(mockArgs))
        .then((result) => {
          assert.include(result.services, { Services: 'redis', Count: '1 container' })
        })
    })
  })
})
