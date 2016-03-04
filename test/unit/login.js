'use strict'

const chai = require('chai')
const os = require('os')
const request = require('request')
const sinon = require('sinon')

require('sinon-as-promised')(require('bluebird'))
chai.use(require('chai-as-promised'))
const assert = chai.assert

const Login = require('../../lib/login')

describe('Login', () => {
  describe('login', () => {
    const mockArgs = {}
    let mockUser
    let mockRes
    let mockBody

    beforeEach(() => {
      mockUser = {
        githubLogin: sinon.stub().yieldsAsync()
      }
      Login.user = mockUser
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

    afterEach(() => {
      Login._makeRequest.restore()
      Login._read.restore()
      Login._output.restore()
    })

    describe('errors', () => {
      it('should reject with any read error', () => {
        Login._read.onFirstCall().rejects(new Error('robot'))
        return assert.isRejected(
          Login.login(mockArgs),
          Error,
          /robot/
        )
      })

      it('should reject with any request error', () => {
        Login._makeRequest.rejects(new Error('robot'))
        return assert.isRejected(
          Login.login(mockArgs),
          Error,
          /robot/
        )
      })

      it('should reject with any login error', () => {
        mockUser.githubLogin.yieldsAsync(new Error('robot'))
        return assert.isRejected(
          Login.login(mockArgs),
          Error,
          /robot/
        )
      })

      it('should reject if the token cannot be created', () => {
        mockRes.statusCode = 400
        return assert.isRejected(
          Login.login(mockArgs),
          Error,
          /could not generate a token/
        )
      })

      it('should reject if the token does not come back in the body', () => {
        mockBody.token = null
        return assert.isRejected(
          Login.login(mockArgs),
          Error,
          /we did not get a token/
        )
      })
    })

    it('should prompt for a username', () => {
      return assert.isFulfilled(Login.login(mockArgs))
        .then(() => {
          sinon.assert.calledTwice(Login._read)
          sinon.assert.calledWithExactly(
            Login._read.firstCall,
            { prompt: 'GitHub username:' }
          )
        })
    })

    it('should prompt for a password', () => {
      return assert.isFulfilled(Login.login(mockArgs))
        .then(() => {
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

    it('should make an authentication request', () => {
      return assert.isFulfilled(Login.login(mockArgs))
        .then(() => {
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

    it('should login to runnable', () => {
      return assert.isFulfilled(Login.login(mockArgs))
        .then(() => {
          sinon.assert.calledOnce(mockUser.githubLogin)
          sinon.assert.calledWithExactly(
            mockUser.githubLogin,
            'mockToken',
            sinon.match.func
          )
        })
    })

    describe('with two factor auth', () => {
      beforeEach(() => {
        mockRes.headers['x-github-otp'] = 'required'
      })

      it('should ask for a one time password', () => {
        return assert.isFulfilled(Login.login(mockArgs))
          .then(() => {
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

      it('should make a second request with the token', () => {
        return assert.isFulfilled(Login.login(mockArgs))
          .then(() => {
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

  describe('_makeRequest', () => {
    const mockCreds = {
      user: 'username',
      pass: 'password'
    }
    const mockToken = '000000'
    const mockRes = { res: 'res' }
    const mockBody = { body: 'body' }

    beforeEach(() => {
      sinon.stub(request, 'post').yieldsAsync(null, mockRes, mockBody)
    })

    afterEach(() => {
      request.post.restore()
    })

    describe('errors', () => {
      it('should reject with any error from post', () => {
        request.post.yieldsAsync(new Error('robot'))
        return assert.isRejected(
          Login._makeRequest(mockCreds),
          Error,
          /robot/
        )
      })
    })

    it('should make a request to github', () => {
      return assert.isFulfilled(Login._makeRequest(mockCreds))
        .then(() => {
          sinon.assert.calledOnce(request.post)
          sinon.assert.calledWithExactly(
            request.post,
            'https://api.github.com/authorizations',
            sinon.match.object,
            sinon.match.func
          )
        })
    })

    describe('with a custom github URL', () => {
      const prevURL = process.env.RUNNABLE_GITHUB_URL

      beforeEach(() => {
        process.env.RUNNABLE_GITHUB_URL = 'http://example.com'
      })

      afterEach(() => {
        process.env.RUNNABLE_GITHUB_URL = prevURL
      })

      it('should make a request to our custom endpoint', () => {
        return assert.isFulfilled(Login._makeRequest(mockCreds))
          .then(() => {
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

    it('should post with correct options by default', () => {
      return assert.isFulfilled(Login._makeRequest(mockCreds))
        .then(() => {
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

    it('should provide any credentials passed to it', () => {
      return assert.isFulfilled(Login._makeRequest({ foo: 'bar' }))
        .then(() => {
          sinon.assert.calledOnce(request.post)
          sinon.assert.calledWithExactly(
            request.post,
            'https://api.github.com/authorizations',
            sinon.match.has('auth', { foo: 'bar' }),
            sinon.match.func
          )
        })
    })

    it('should add an OTP if provided', () => {
      return assert.isFulfilled(Login._makeRequest(mockCreds, mockToken))
        .then(() => {
          sinon.assert.calledOnce(request.post)
          sinon.assert.calledWithExactly(
            request.post,
            'https://api.github.com/authorizations',
            sinon.match.has('headers', sinon.match.has('x-github-otp', mockToken)),
            sinon.match.func
          )
        })
    })

    it('should resolve with the response and body', () => {
      return assert.isFulfilled(Login._makeRequest(mockCreds, mockToken))
        .then((results) => {
          assert.deepEqual(results, [ mockRes, mockBody ])
        })
    })
  })

  describe('chooseOrg', () => {
    const mockArgs = {}
    let mockUser
    const mockOrgs = [
      { login: 'foo' },
      { login: 'bar' }
    ]

    beforeEach(() => {
      mockUser = {
        fetchGithubOrgs: sinon.stub().yieldsAsync(null, mockOrgs)
      }
      Login.user = mockUser
      sinon.stub(Login, '_read').resolves('1')
      sinon.stub(Login, '_output')
    })

    afterEach(() => {
      Login._read.restore()
      Login._output.restore()
    })

    describe('errors', () => {
      it('should reject with any fetch orgs error', () => {
        mockUser.fetchGithubOrgs.yieldsAsync(new Error('robot'))
        return assert.isRejected(
          Login.chooseOrg(mockArgs),
          Error,
          /robot/
        )
      })

      it('should reject with any read prompt error', () => {
        Login._read.rejects(new Error('robot'))
        return assert.isRejected(
          Login.chooseOrg(mockArgs),
          Error,
          /robot/
        )
      })
    })

    it('should fetch the github orgs', () => {
      return assert.isFulfilled(Login.chooseOrg(mockArgs))
        .then(() => {
          sinon.assert.calledOnce(mockUser.fetchGithubOrgs)
          sinon.assert.calledWithExactly(
            mockUser.fetchGithubOrgs,
            sinon.match.func
          )
        })
    })

    it('should prompt with the list of orgs', () => {
      return assert.isFulfilled(Login.chooseOrg(mockArgs))
        .then(() => {
          sinon.assert.calledOnce(Login._read)
          sinon.assert.calledWithExactly(
            Login._read,
            { prompt: sinon.match.string }
          )
        })
    })

    it('should pick an org by name', () => {
      Login._read.resolves('foo')
      return assert.isFulfilled(Login.chooseOrg(mockArgs))
        .then((org) => {
          assert.equal(org, 'foo')
        })
    })

    it('should prompt twice if the first input was bad', () => {
      Login._read.onFirstCall().resolves('baz')
      Login._read.onSecondCall().resolves('2')
      return assert.isFulfilled(Login.chooseOrg(mockArgs))
        .then((org) => {
          assert.equal(org, 'foo')
          sinon.assert.calledTwice(Login._read)
        })
    })

    it('should print the selected org', () => {
      return assert.isFulfilled(Login.chooseOrg(mockArgs))
        .then(() => {
          sinon.assert.calledOnce(Login._output)
          sinon.assert.calledWithExactly(
            Login._output,
            sinon.match(/selected organization/i),
            'bar'
          )
        })
    })

    it('should resolve with the name of the selected org', () => {
      return assert.isFulfilled(Login.chooseOrg(mockArgs))
        .then((org) => {
          assert.equal(org, 'bar')
        })
    })
  })
})
