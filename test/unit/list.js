'use strict'

var chai = require('chai')
var sinon = require('sinon')

chai.use(require('chai-as-promised'))
var assert = chai.assert

var List = require('../../lib/list')

describe('Container Methods', function () {
  describe('listContainersForRepository', function () {
    var mockArgs
    var mockInstances
    var mockUser

    beforeEach(function () {
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
      mockArgs._user = mockUser
    })

    it('should be a function', function () {
      assert.isFunction(List.listContainersForRepository)
    })

    it('should require repository', function () {
      mockArgs.repository = null
      return assert.isRejected(
        List.listContainersForRepository(mockArgs),
        /repository.+required/i
      )
    })

    it('should fetch instances', function () {
      return assert.isFulfilled(List.listContainersForRepository(mockArgs))
        .then(function () {
          sinon.assert.calledOnce(mockUser.fetchInstances)
          sinon.assert.calledWithExactly(
            mockUser.fetchInstances,
            { githubUsername: 'bkendall' },
            sinon.match.func
          )
        })
    })

    it('should always fetch for the mockUser._org value', function () {
      mockUser._org = 'foobar'
      return assert.isFulfilled(List.listContainersForRepository(mockArgs))
        .then(function () {
          sinon.assert.calledOnce(mockUser.fetchInstances)
          sinon.assert.calledWithExactly(
            mockUser.fetchInstances,
            { githubUsername: 'foobar' },
            sinon.match.func
          )
        })
    })

    it('should resolve with an array', function () {
      return assert.isFulfilled(List.listContainersForRepository(mockArgs))
        .then(function (result) {
          assert.isArray(result)
        })
    })

    it('should filter repositories for the specified org', function () {
      mockInstances.push({
        lowerName: 'bar',
        contextVersion: { appCodeVersions: [{ lowerRepo: 'bkendall/bar', lowerBranch: 'master' }] },
        container: { inspect: { State: { Status: 'Running' } } },
        shortHash: 'bar00'
      })
      return assert.isFulfilled(List.listContainersForRepository(mockArgs))
        .then(function (result) {
          assert.lengthOf(result, 2)
        })
    })

    it('should ignore non-repo containers', function () {
      mockInstances.push({
        lowerName: 'redis',
        contextVersion: { appCodeVersions: [] },
        container: { inspect: { State: { Status: 'Running' } } },
        shortHash: 'redis00'
      })
      return assert.isFulfilled(List.listContainersForRepository(mockArgs))
        .then(function (result) {
          assert.lengthOf(result, 2)
        })
    })

    it('should put a dash for unknown containers', function () {
      mockInstances[0].container = null
      return assert.isFulfilled(List.listContainersForRepository(mockArgs))
        .then(function (result) {
          assert.equal(result[0].Status, '-')
        })
    })
  })

  describe('listContainerSummary', function () {
    var mockArgs
    var mockInstances
    var mockUser

    beforeEach(function () {
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
      mockArgs._user = mockUser
    })

    it('should fetch user instances', function () {
      return assert.isFulfilled(List.listContainerSummary(mockArgs))
        .then(function () {
          sinon.assert.calledOnce(mockUser.fetchInstances)
          sinon.assert.calledWithExactly(
            mockUser.fetchInstances,
            { githubUsername: 'bkendall' },
            sinon.match.func
          )
        })
    })

    it('should return an object with two array keys', function () {
      return assert.isFulfilled(List.listContainerSummary(mockArgs))
        .then(function (result) {
          assert.isObject(result)
          assert.isArray(result.repositories)
          assert.isArray(result.services)
        })
    })

    it('should return a list of repositories and container counts', function () {
      return assert.isFulfilled(List.listContainerSummary(mockArgs))
        .then(function (result) {
          assert.include(result.repositories, { Repositories: 'foo', Count: '2 containers' })
        })
    })

    it('should not pluralize repository counts if only one exists', function () {
      mockInstances.splice(1, 1)
      return assert.isFulfilled(List.listContainerSummary(mockArgs))
        .then(function (result) {
          assert.include(result.repositories, { Repositories: 'foo', Count: '1 container' })
        })
    })

    it('should return a list of services and container counts', function () {
      return assert.isFulfilled(List.listContainerSummary(mockArgs))
        .then(function (result) {
          assert.include(result.services, { Services: 'redis', Count: '1 container' })
        })
    })
  })
})
