'use strict'

var chai = require('chai')
var sinon = require('sinon')
var fs = require('fs')

require('sinon-as-promised')(require('bluebird'))
chai.use(require('chai-as-promised'))
var assert = chai.assert

var utils = require('../../lib/utils')
var upload = require('../../lib/upload')

describe('Upload Methods', function () {
  describe('uploadFile', function () {
    var mockArgs
    var mockInstance
    var mockContainer
    var mockUser
    var mockFileData = new Buffer('mockFileData')

    beforeEach(function () {
      mockContainer = {}
      mockContainer.createFile = sinon.stub().yieldsAsync()
      mockInstance = {
        _id: 'mockInstanceId',
        container: {
          dockerContainer: 'mockContainerId',
          inspect: {
            Config: {
              WorkingDir: '/cwd'
            }
          }
        },
        newContainer: sinon.stub().returns(mockContainer)
      }
      mockUser = {}
      mockUser.newInstance = sinon.stub().returns(mockInstance)
      sinon.stub(utils, 'getRepositoryAndInstance')
      sinon.stub(fs, 'readFile').yieldsAsync(null, mockFileData)
      sinon.spy(upload, '_createFile')
      sinon.spy(upload, '_recusivelyCreateDirectories')
    })

    afterEach(function () {
      utils.getRepositoryAndInstance.restore()
      fs.readFile.restore()
      upload._createFile.restore()
      upload._recusivelyCreateDirectories.restore()
    })

    describe('to a top level directory', function () {
      beforeEach(function () {
        mockArgs = { _user: mockUser, file: 'mockFile.txt' }
        utils.getRepositoryAndInstance.resolves([ mockArgs, mockInstance ])
      })

      it('should fetch the repository an instance', function () {
        return assert.isFulfilled(upload.uploadFile(mockArgs))
          .then(function () {
            sinon.assert.calledOnce(utils.getRepositoryAndInstance)
            sinon.assert.calledWithExactly(
              utils.getRepositoryAndInstance,
              mockArgs
            )
          })
      })

      it('should read the file', function () {
        return assert.isFulfilled(upload.uploadFile(mockArgs))
          .then(function () {
            sinon.assert.calledOnce(fs.readFile)
            sinon.assert.calledWithExactly(
              fs.readFile,
              sinon.match(/.+mockFile.txt$/),
              sinon.match.func
            )
          })
      })

      it('should create a container model', function () {
        return assert.isFulfilled(upload.uploadFile(mockArgs))
          .then(function () {
            sinon.assert.calledOnce(mockUser.newInstance)
            sinon.assert.calledWithExactly(
              mockUser.newInstance,
              'mockInstanceId'
            )
            sinon.assert.calledOnce(mockInstance.newContainer)
            sinon.assert.calledWithExactly(
              mockInstance.newContainer,
              'mockContainerId'
            )
          })
      })

      it('should upload the file', function () {
        return assert.isFulfilled(upload.uploadFile(mockArgs))
          .then(function () {
            sinon.assert.calledWith(
              upload._recusivelyCreateDirectories,
              sinon.match(mockContainer),
              '/cwd',
              ''
            )
            sinon.assert.calledWith(
              upload._createFile,
              sinon.match(mockContainer),
              '/cwd',
              'mockFile.txt',
              sinon.match(mockFileData)
            )
          })
      })
    })

    describe('to a child directory', function () {
      beforeEach(function () {
        mockArgs = {
          _user: mockUser,
          file: 'mockFile.txt',
          path: '/super-path/another-path'
        }
        utils.getRepositoryAndInstance.resolves([ mockArgs, mockInstance ])
      })

      it('should upload the file to the specified directory', function () {
        return assert.isFulfilled(upload.uploadFile(mockArgs))
          .then(function () {
            sinon.assert.calledWith(
              upload._recusivelyCreateDirectories,
              sinon.match(mockContainer),
              '/cwd',
              '/super-path/another-path'
            )
            sinon.assert.calledWith(
              upload._createFile,
              sinon.match(mockContainer),
              '/cwd/super-path/another-path',
              'mockFile.txt',
              sinon.match(mockFileData)
            )
          })
      })
    })
  })
})
