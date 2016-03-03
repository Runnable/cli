'use strict'

var chai = require('chai')
var os = require('os')
var request = require('request')
var sinon = require('sinon')

require('sinon-as-promised')(require('bluebird'))
chai.use(require('chai-as-promised'))
var assert = chai.assert

var Login = require('../../lib/login')

describe('Login', function () {
  describe('login', function () {
    var mockArgs
    var mockUser
    var mockRes
    var mockBody

    beforeEach(function () {
      mockUser = {
        githubLogin: sinon.stub().yieldsAsync()
      }
      mockArgs = {
        _user: mockUser
      }
      mockRes = {
        statusCode: 201,
        headers: {}
      }
      mockBody = {
        token: 'mockToken'
      }
      sinon.stub(Login, '_makeRequest').resolves([ mockRes, mockBody ])
      sinon.stub(Login, '_read').resolves()
      Login._read.onFirstCall().resolves('user')
      Login._read.onSecondCall().resolves('pass')
      Login._read.onThirdCall().resolves('000000')
      sinon.stub(Login, '_output')
    })

    afterEach(function () {
      Login._makeRequest.restore()
      Login._read.restore()
      Login._output.restore()
    })

    describe('errors', function () {
      it('should reject with any read error', function () {
        Login._read.onFirstCall().rejects(new Error('robot'))
        return assert.isRejected(
          Login.login(mockArgs),
          Error,
          /robot/
        )
      })

      it('should reject with any request error', function () {
        Login._makeRequest.rejects(new Error('robot'))
        return assert.isRejected(
          Login.login(mockArgs),
          Error,
          /robot/
        )
      })

      it('should reject with any login error', function () {
        mockUser.githubLogin.yieldsAsync(new Error('robot'))
        return assert.isRejected(
          Login.login(mockArgs),
          Error,
          /robot/
        )
      })

      it('should reject if the token cannot be created', function () {
        mockRes.statusCode = 400
        return assert.isRejected(
          Login.login(mockArgs),
          Error,
          /could not generate a token/
        )
      })

      it('should reject if the token does not come back in the body', function () {
        mockBody.token = null
        return assert.isRejected(
          Login.login(mockArgs),
          Error,
          /we did not get a token/
        )
      })
    })

    it('should prompt for a username', function () {
      return assert.isFulfilled(Login.login(mockArgs))
        .then(function () {
          sinon.assert.calledTwice(Login._read)
          sinon.assert.calledWithExactly(
            Login._read.firstCall,
            { prompt: 'GitHub username:' }
          )
        })
    })

    it('should prompt for a password', function () {
      return assert.isFulfilled(Login.login(mockArgs))
        .then(function () {
          sinon.assert.calledTwice(Login._read)
          sinon.assert.calledWithExactly(
            Login._read.secondCall,
            {
              prompt: 'GitHub password:',
              silent: true,
              replace: '*'
            }
          )
        })
    })

    it('should make an authentication request', function () {
      return assert.isFulfilled(Login.login(mockArgs))
        .then(function () {
          sinon.assert.calledOnce(Login._makeRequest)
          sinon.assert.calledWithExactly(
            Login._makeRequest,
            {
              user: 'user',
              pass: 'pass'
            }
          )
        })
    })

    it('should login to runnable', function () {
      return assert.isFulfilled(Login.login(mockArgs))
        .then(function () {
          sinon.assert.calledOnce(mockUser.githubLogin)
          sinon.assert.calledWithExactly(
            mockUser.githubLogin,
            'mockToken',
            sinon.match.func
          )
        })
    })

    describe('with two factor auth', function () {
      beforeEach(function () {
        mockRes.headers['x-github-otp'] = 'required'
      })

      it('should ask for a one time password', function () {
        return assert.isFulfilled(Login.login(mockArgs))
          .then(function () {
            sinon.assert.calledThrice(Login._read)
            sinon.assert.calledWithExactly(
              Login._read.thirdCall,
              {
                prompt: 'Two-factor code:',
                silent: true,
                replace: '*'
              }
            )
          })
      })

      it('should make a second request with the token', function () {
        return assert.isFulfilled(Login.login(mockArgs))
          .then(function () {
            sinon.assert.calledTwice(Login._makeRequest)
            sinon.assert.calledWithExactly(
              Login._makeRequest.secondCall,
              {
                user: 'user',
                pass: 'pass'
              },
              '000000'
            )
          })
      })
    })
  })

  describe('_makeRequest', function () {
    var mockCreds = {
      user: 'username',
      pass: 'password'
    }
    var mockToken = '000000'
    var mockRes = { res: 'res' }
    var mockBody = { body: 'body' }

    beforeEach(function () {
      sinon.stub(request, 'post').yieldsAsync(null, mockRes, mockBody)
    })

    afterEach(function () {
      request.post.restore()
    })

    describe('errors', function () {
      it('should reject with any error from post', function () {
        request.post.yieldsAsync(new Error('robot'))
        return assert.isRejected(
          Login._makeRequest(mockCreds),
          Error,
          /robot/
        )
      })
    })

    it('should make a request to github', function () {
      return assert.isFulfilled(Login._makeRequest(mockCreds))
        .then(function () {
          sinon.assert.calledOnce(request.post)
          sinon.assert.calledWithExactly(
            request.post,
            'https://api.github.com/authorizations',
            sinon.match.object,
            sinon.match.func
          )
        })
    })

    describe('with a custom github URL', function () {
      var prevURL = process.env.RUNNABLE_GITHUB_URL

      beforeEach(function () {
        process.env.RUNNABLE_GITHUB_URL = 'http://example.com'
      })

      afterEach(function () {
        process.env.RUNNABLE_GITHUB_URL = prevURL
      })

      it('should make a request to our custom endpoint', function () {
        return assert.isFulfilled(Login._makeRequest(mockCreds))
          .then(function () {
            sinon.assert.calledOnce(request.post)
            sinon.assert.calledWithExactly(
              request.post,
              'http://example.com/authorizations',
              sinon.match.object,
              sinon.match.func
            )
          })
      })
    })

    it('should post with correct options by default', function () {
      return assert.isFulfilled(Login._makeRequest(mockCreds))
        .then(function () {
          sinon.assert.calledOnce(request.post)
          sinon.assert.calledWithExactly(
            request.post,
            'https://api.github.com/authorizations',
            {
              auth: mockCreds,
              headers: {
                'User-Agent': 'Runnable CLI',
                accept: 'application/json'
              },
              json: {
                scopes: [ 'repo', 'user:email' ],
                note: 'Runnable CLI for ' + os.hostname()
              }
            },
            sinon.match.func
          )
        })
    })

    it('should provide any credentials passed to it', function () {
      return assert.isFulfilled(Login._makeRequest({ foo: 'bar' }))
        .then(function () {
          sinon.assert.calledOnce(request.post)
          sinon.assert.calledWithExactly(
            request.post,
            'https://api.github.com/authorizations',
            sinon.match.has('auth', { foo: 'bar' }),
            sinon.match.func
          )
        })
    })

    it('should add an OTP if provided', function () {
      return assert.isFulfilled(Login._makeRequest(mockCreds, mockToken))
        .then(function () {
          sinon.assert.calledOnce(request.post)
          sinon.assert.calledWithExactly(
            request.post,
            'https://api.github.com/authorizations',
            sinon.match.has('headers', sinon.match.has('x-github-otp', mockToken)),
            sinon.match.func
          )
        })
    })

    it('should resolve with the response and body', function () {
      return assert.isFulfilled(Login._makeRequest(mockCreds, mockToken))
        .then(function (results) {
          assert.deepEqual(results, [ mockRes, mockBody ])
        })
    })
  })

  describe('chooseOrg', function () {
    var mockArgs
    var mockUser
    var mockOrgs = [
      { login: 'foo' },
      { login: 'bar' }
    ]

    beforeEach(function () {
      mockUser = {
        fetchGithubOrgs: sinon.stub().yieldsAsync(null, mockOrgs)
      }
      mockArgs = { _user: mockUser }
      sinon.stub(Login, '_read').resolves('1')
      sinon.stub(Login, '_output')
    })

    afterEach(function () {
      Login._read.restore()
      Login._output.restore()
    })

    describe('errors', function () {
      it('should reject with any fetch orgs error', function () {
        mockUser.fetchGithubOrgs.yieldsAsync(new Error('robot'))
        return assert.isRejected(
          Login.chooseOrg(mockArgs),
          Error,
          /robot/
        )
      })

      it('should reject with any read prompt error', function () {
        Login._read.rejects(new Error('robot'))
        return assert.isRejected(
          Login.chooseOrg(mockArgs),
          Error,
          /robot/
        )
      })
    })

    it('should fetch the github orgs', function () {
      return assert.isFulfilled(Login.chooseOrg(mockArgs))
        .then(function () {
          sinon.assert.calledOnce(mockUser.fetchGithubOrgs)
          sinon.assert.calledWithExactly(
            mockUser.fetchGithubOrgs,
            sinon.match.func
          )
        })
    })

    it('should prompt with the list of orgs', function () {
      return assert.isFulfilled(Login.chooseOrg(mockArgs))
        .then(function () {
          sinon.assert.calledOnce(Login._read)
          sinon.assert.calledWithExactly(
            Login._read,
            { prompt: sinon.match.string }
          )
        })
    })

    it('should pick an org by name', function () {
      Login._read.resolves('foo')
      return assert.isFulfilled(Login.chooseOrg(mockArgs))
        .then(function (org) {
          assert.equal(org, 'foo')
        })
    })

    it('should prompt twice if the first input was bad', function () {
      Login._read.onFirstCall().resolves('baz')
      Login._read.onSecondCall().resolves('2')
      return assert.isFulfilled(Login.chooseOrg(mockArgs))
        .then(function (org) {
          assert.equal(org, 'foo')
          sinon.assert.calledTwice(Login._read)
        })
    })

    it('should print the selected org', function () {
      return assert.isFulfilled(Login.chooseOrg(mockArgs))
        .then(function () {
          sinon.assert.calledOnce(Login._output)
          sinon.assert.calledWithExactly(
            Login._output,
            sinon.match(/selected organization/i),
            'bar'
          )
        })
    })

    it('should resolve with the name of the selected org', function () {
      return assert.isFulfilled(Login.chooseOrg(mockArgs))
        .then(function (org) {
          assert.equal(org, 'bar')
        })
    })
  })
})

