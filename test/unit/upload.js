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
      mockArgs = { _user: mockUser, file: 'mockFile.txt' }
      sinon.stub(utils, 'getRepositoryAndInstance').resolves([ mockArgs, mockInstance ])
      sinon.stub(fs, 'readFile').yieldsAsync(null, mockFileData)
    })

    afterEach(function () {
      utils.getRepositoryAndInstance.restore()
      fs.readFile.restore()
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
          sinon.assert.calledTwice(mockContainer.createFile)
          var fileSpyCall = mockContainer.createFile.getCall(1)
          fileSpyCall.calledWithExactly(
            mockContainer.createFile,
            {
              name: 'mockFile.txt',
              path: sinon.match.string,
              isDir: false,
              content: 'mockFileData'
            },
            sinon.match.func
          )
        })
    })
  })
})
