'use strict'

var chai = require('chai')
var sinon = require('sinon')
var fs = require('fs')
var Promise = require('bluebird')

require('sinon-as-promised')(Promise)
chai.use(require('chai-as-promised'))
var assert = chai.assert

var utils = require('../../lib/utils')
var upload = require('../../lib/upload')

describe('Upload Methods', function () {
  var mockContainer
  var mockFileData = new Buffer('mockFileData')

  beforeEach(function () {
    mockContainer = {}
    mockContainer.createFile = sinon.stub().yieldsAsync()
  })

  describe('uploadFile', function () {
    var mockArgs
    var mockInstance
    var mockUser

    beforeEach(function () {
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

  describe('_recusivelyCreateDirectories', function () {
    var parentPath = '/cwd'

    beforeEach(function () {
      sinon.stub(upload, '_createDirectory')
    })

    afterEach(function () {
      upload._createDirectory.restore()
    })

    describe('with non-existing directories', function () {
      beforeEach(function () {
        upload._createDirectory.resolves()
      })

      it('should not create any directories if none are passed', function () {
        return assert.isFulfilled(upload._recusivelyCreateDirectories(mockContainer, parentPath, '/'))
          .then(function () {
            assert.equal(upload._createDirectory.callCount, 0)
          })
      })

      it('should create all directories', function () {
        return assert.isFulfilled(upload._recusivelyCreateDirectories(mockContainer, parentPath, '/0/1/2/3/4/'))
          .then(function () {
            assert.equal(upload._createDirectory.callCount, 5)
            var arr = [0, 1, 2, 3, 4]
            arr.forEach(function (num) {
              var call = upload._createDirectory.getCall(num)
              call.calledWith(sinon.match.any, parentPath, num)
            })
          })
      })

      it('should not care whether theres a forward slash at the end', function () {
        return assert.isFulfilled(upload._recusivelyCreateDirectories(mockContainer, parentPath, '0/1/2'))
          .then(function () {
            assert.equal(upload._createDirectory.callCount, 3)
            var arr = [0, 1, 2]
            arr.forEach(function (num) {
              var call = upload._createDirectory.getCall(num)
              call.calledWith(sinon.match.any, parentPath, num)
            })
          })
      })
    })

    describe('with existing directories', function () {
      beforeEach(function () {
        upload._createDirectory.rejects()
      })

      it('should create all directories', function () {
        return assert.isFulfilled(upload._recusivelyCreateDirectories(mockContainer, parentPath, '/0/1/2/3/4/'))
          .then(function () {
            assert.equal(upload._createDirectory.callCount, 5)
            var arr = [0, 1, 2, 3, 4]
            arr.forEach(function (num) {
              var call = upload._createDirectory.getCall(num)
              call.calledWith(sinon.match.any, parentPath, num)
            })
          })
      })
    })
  })

  describe('_createFile', function () {
    var path = '/cwd/hello/world'
    var file = 'hello.js'

    it('should call the container.createFile method', function () {
      upload._createFile(mockContainer, path, file, mockFileData)
      sinon.assert.calledWith(
        mockContainer.createFile,
        {
          path: path,
          name: file,
          isDir: false,
          content: mockFileData.toString()
        },
        sinon.match.func
      )
    })

    it('should return a promise', function () {
      assert.isFulfilled(upload._createFile(mockContainer, path, file, mockFileData))
    })
  })

  describe('_createDirectory', function () {
    var path = '/cwd/hello/world'
    var newPath = 'again'

    it('should call the container.createFile method', function () {
      return assert.isFulfilled(upload._createDirectory(mockContainer, path, newPath))
        .then(function () {
          sinon.assert.calledWith(
            mockContainer.createFile,
            {
              path: path,
              name: newPath,
              isDir: true
            },
            sinon.match.func
          )
        })
    })
  })
})
