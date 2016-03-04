'use strict'

const chai = require('chai')
const sinon = require('sinon')
const fs = require('fs')

require('sinon-as-promised')(require('bluebird'))
chai.use(require('chai-as-promised'))
const assert = chai.assert

const Utils = require('../../lib/utils')
const Upload = require('../../lib/upload')

describe('Upload Methods', () => {
  let mockContainer
  const mockFileData = new Buffer('mockFileData')

  beforeEach(() => {
    mockContainer = {}
    mockContainer.createFile = sinon.stub().yieldsAsync()
  })

  describe('uploadFile', () => {
    let mockArgs
    let mockInstance
    let mockUser

    beforeEach(() => {
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
      Upload.user = mockUser
      mockArgs = { file: 'mockFile.txt' }
      sinon.stub(Utils, 'getRepositoryAndInstance').resolves([ mockArgs, mockInstance ])
      sinon.stub(fs, 'readFile').yieldsAsync(null, mockFileData)
      sinon.stub(Upload, '_createFile').resolves()
      sinon.stub(Upload, '_recusivelyCreateDirectories').resolves()
    })

    afterEach(() => {
      Utils.getRepositoryAndInstance.restore()
      fs.readFile.restore()
      Upload._createFile.restore()
      Upload._recusivelyCreateDirectories.restore()
    })

    describe('to the current working directory', () => {
      it('should fetch the repository an instance', () => {
        return assert.isFulfilled(Upload.uploadFile(mockArgs))
          .then(() => {
            sinon.assert.calledOnce(Utils.getRepositoryAndInstance)
            sinon.assert.calledWithExactly(
              Utils.getRepositoryAndInstance,
              mockArgs
            )
          })
      })

      it('should read the file', () => {
        return assert.isFulfilled(Upload.uploadFile(mockArgs))
          .then(() => {
            sinon.assert.calledOnce(fs.readFile)
            sinon.assert.calledWithExactly(
              fs.readFile,
              sinon.match(/.+mockFile.txt$/),
              sinon.match.func
            )
          })
      })

      it('should create a container model', () => {
        return assert.isFulfilled(Upload.uploadFile(mockArgs))
          .then(() => {
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

      it('should upload the file', () => {
        return assert.isFulfilled(Upload.uploadFile(mockArgs))
          .then(() => {
            sinon.assert.calledWith(
              Upload._recusivelyCreateDirectories,
              sinon.match(mockContainer),
              '/cwd',
              ''
            )
            sinon.assert.calledWith(
              Upload._createFile,
              sinon.match(mockContainer),
              '/cwd',
              'mockFile.txt',
              sinon.match(mockFileData)
            )
          })
      })
    })

    describe('to a child directory', () => {
      beforeEach(() => {
        mockArgs.path = 'super-path/another-path'
      })

      it('should upload the file to the specified directory', () => {
        return assert.isFulfilled(Upload.uploadFile(mockArgs))
          .then(() => {
            sinon.assert.calledWith(
              Upload._recusivelyCreateDirectories,
              sinon.match(mockContainer),
              '/cwd',
              'super-path/another-path'
            )
            sinon.assert.calledWith(
              Upload._createFile,
              sinon.match(mockContainer),
              '/cwd/super-path/another-path',
              'mockFile.txt',
              sinon.match(mockFileData)
            )
          })
      })
    })

    describe('to a parent directory', () => {
      beforeEach(() => {
        mockArgs.path = '/super-path/another-path'
      })

      it('should upload the file to the specified directory', () => {
        return assert.isFulfilled(Upload.uploadFile(mockArgs))
          .then(() => {
            sinon.assert.calledWith(
              Upload._recusivelyCreateDirectories,
              sinon.match(mockContainer),
              '/',
              '/super-path/another-path'
            )
            sinon.assert.calledWith(
              Upload._createFile,
              sinon.match(mockContainer),
              '/super-path/another-path',
              'mockFile.txt',
              sinon.match(mockFileData)
            )
          })
      })
    })
  })

  describe('_recusivelyCreateDirectories', () => {
    const parentPath = '/cwd'

    beforeEach(() => {
      sinon.stub(Upload, '_createDirectory')
    })

    afterEach(() => {
      Upload._createDirectory.restore()
    })

    describe('with non-existing directories', () => {
      beforeEach(() => {
        Upload._createDirectory.resolves()
      })

      it('should not create any directories if none are passed', () => {
        return assert.isFulfilled(Upload._recusivelyCreateDirectories(mockContainer, parentPath, '/'))
          .then(() => {
            assert.equal(Upload._createDirectory.callCount, 0)
          })
      })

      it('should create all directories', () => {
        return assert.isFulfilled(Upload._recusivelyCreateDirectories(mockContainer, parentPath, '/0/1/2/3/4/'))
          .then(() => {
            assert.equal(Upload._createDirectory.callCount, 5)
            const arr = [0, 1, 2, 3, 4]
            arr.forEach(function (num) {
              const call = Upload._createDirectory.getCall(num)
              call.calledWith(sinon.match.any, parentPath, num)
            })
          })
      })

      it('should not care whether theres a forward slash at the end', () => {
        return assert.isFulfilled(Upload._recusivelyCreateDirectories(mockContainer, parentPath, '0/1/2'))
          .then(() => {
            assert.equal(Upload._createDirectory.callCount, 3)
            const arr = [0, 1, 2]
            arr.forEach(function (num) {
              const call = Upload._createDirectory.getCall(num)
              call.calledWith(sinon.match.any, parentPath, num)
            })
          })
      })
    })

    describe('with existing directories', () => {
      beforeEach(() => {
        Upload._createDirectory.rejects()
      })

      it('should create all directories', () => {
        return assert.isFulfilled(Upload._recusivelyCreateDirectories(mockContainer, parentPath, '/0/1/2/3/4/'))
          .then(() => {
            assert.equal(Upload._createDirectory.callCount, 5)
            const arr = [0, 1, 2, 3, 4]
            arr.forEach(function (num) {
              const call = Upload._createDirectory.getCall(num)
              call.calledWith(sinon.match.any, parentPath, num)
            })
          })
      })
    })
  })

  describe('_createFile', () => {
    const path = '/cwd/hello/world'
    const file = 'hello.js'

    it('should call the container.createFile method', () => {
      return assert.isFulfilled(Upload._createFile(mockContainer, path, file, mockFileData))
        .then(() => {
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
    })
  })

  describe('_createDirectory', () => {
    const path = '/cwd/hello/world'
    const newPath = 'again'

    it('should call the container.createFile method', () => {
      return assert.isFulfilled(Upload._createDirectory(mockContainer, path, newPath))
        .then(() => {
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
