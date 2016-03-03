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
    })

    afterEach(function () {
      utils.getRepositoryAndInstance.restore()
      fs.readFile.restore()
    })

    describe('Top level directory', function () {
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
            sinon.assert.calledOnce(mockContainer.createFile)
            var fileSpyCall = mockContainer.createFile.getCall(0)
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

    describe('Child directory', function () {
      beforeEach(function () {
        mockArgs = {
          _user: mockUser,
          file: 'mockFile.txt',
          path: '/super-path/another-path'
        }
        utils.getRepositoryAndInstance.resolves([ mockArgs, mockInstance ])
      })

      describe('Child directory not created', function () {
        it('should upload the file to the specified directory', function () {
          return assert.isFulfilled(upload.uploadFile(mockArgs))
            .then(function () {
              assert.equal(
                mockContainer.createFile.callCount,
                4,
                'it was called correctly'
              )
              var fileSpyCall = mockContainer.createFile.getCall(2)
              fileSpyCall.calledWithExactly(
                mockContainer.createFile,
                {
                  name: 'mockFile.txt',
                  path: sinon.match(/super-path/i),
                  isDir: false,
                  content: 'mockFileData'
                },
                sinon.match.func
              )
            })
        })

        it('should always create all necessary directories', function () {
          return assert.isFulfilled(upload.uploadFile(mockArgs))
            .then(function () {
              assert.equal(
                mockContainer.createFile.callCount,
                4,
                'it was called correctly'
              )
              var directorySpyCall = mockContainer.createFile.getCall(0)
              directorySpyCall.calledWithExactly(
                mockContainer.createFile,
                {
                  name: 'cwd',
                  path: sinon.match.string,
                  isDir: true
                },
                sinon.match.func
              )
              var directorySpyCall2 = mockContainer.createFile.getCall(1)
              directorySpyCall2.calledWithExactly(
                mockContainer.createFile,
                {
                  name: 'super-path',
                  path: sinon.match.string,
                  isDir: true
                },
                sinon.match.func
              )
              var directorySpyCall3 = mockContainer.createFile.getCall(2)
              directorySpyCall3.calledWithExactly(
                mockContainer.createFile,
                {
                  name: 'another-path',
                  path: sinon.match.string,
                  isDir: true
                },
                sinon.match.func
              )
            })
        })
      })

      describe('Not existing child directories', function () {
        beforeEach(function () {
          mockContainer.createFile.onThirdCall()
            .yieldsAsync(new Error('Exists'))
        })

        it('should always create all necessary directories', function () {
          return assert.isFulfilled(upload.uploadFile(mockArgs))
            .then(function () {
              assert.equal(
                mockContainer.createFile.callCount,
                4,
                'it was called correctly'
              )
              var directorySpyCall = mockContainer.createFile.getCall(0)
              directorySpyCall.calledWithExactly(
                mockContainer.createFile,
                {
                  name: 'cwd',
                  path: sinon.match.string,
                  isDir: true
                },
                sinon.match.func
              )
              var directorySpyCall2 = mockContainer.createFile.getCall(1)
              directorySpyCall2.calledWithExactly(
                mockContainer.createFile,
                {
                  name: 'super-path',
                  path: sinon.match.string,
                  isDir: true
                },
                sinon.match.func
              )
              var directorySpyCall3 = mockContainer.createFile.getCall(2)
              directorySpyCall3.calledWithExactly(
                mockContainer.createFile,
                {
                  name: 'another-path',
                  path: sinon.match.string,
                  isDir: true
                },
                sinon.match.func
              )
            })
        })
      })
    })
  })
})
