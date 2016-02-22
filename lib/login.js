'use strict'

var Promise = require('bluebird')
var read = Promise.promisify(require('read'))
var request = require('request')
var url = require('url')
var pluck = require('101/pluck')
var os = require('os')

var Login = module.exports = {
  _read: read,
  _output: console.log,

  login: Promise.method(function (args) {
    return Login._read({ prompt: 'GitHub username:' })
      .then(function (username) {
        return Login._read({
          prompt: 'GitHub password:',
          silent: true,
          replace: '*'
        })
          .then(function (password) {
            return { user: username, pass: password }
          })
      })
      .then(function (creds) {
        return Login._makeRequest(creds)
          .spread(function (res, body) {
            var otpHeader = res.headers['x-github-otp']
            if (otpHeader && otpHeader.indexOf('required') > -1) {
              return Login._read({
                prompt: 'Two-factor code:',
                silent: true,
                replace: '*'
              })
                .then(function (otp) {
                  return Login._makeRequest(creds, otp)
                })
            } else {
              return [ res, body ]
            }
          })
      })
      .spread(function (res, body) {
        if (res.statusCode !== 201) {
          throw new Error('we could not generate a token')
        }
        if (!body.token) {
          throw new Error('we did not get a token back. :(')
        }
        return Promise.fromCallback(function (callback) {
          args._user.githubLogin(body.token, callback)
        })
      })
      .then(function () {
        Login._output('Authenticated!')
      })
  }),

  _makeRequest: Promise.method(function (creds, token) {
    var githubURL = process.env.RUNNABLE_GITHUB_URL || 'https://api.github.com'
    var parsedURL = url.parse(githubURL)
    parsedURL.pathname = '/authorizations'
    var targetURL = url.format(parsedURL)
    var opts = {
      auth: creds,
      headers: {
        'User-Agent': 'Runnable CLI',
        accept: 'application/json'
      },
      json: {
        scopes: [ 'repo', 'user:email' ],
        note: 'Runnable CLI for ' + os.hostname()
      }
    }
    if (token) {
      opts.headers['x-github-otp'] = token
    }
    return Promise.fromCallback(function (callback) {
      request.post(targetURL, opts, callback)
    }, { multiArgs: true })
  }),

  chooseOrg: Promise.method(function (args) {
    return Promise.fromCallback(function (callback) {
      args._user.fetchGithubOrgs(callback)
    })
      .then(function (orgsData) {
        return orgsData.map(pluck('login')).sort()
      })
      .then(function (orgs) {
        var orgList = orgs.map(function (o, i) {
          return '  ' + (i + 1) + ') ' + o
        })
        var rangeString = '[1-' + orgList.length + ']'
        var prompt = [
          'Choose a GitHub organization to use with Runnable ' + rangeString,
          '',
          orgList.join('\n'),
          '',
          '>'
        ].join('\n')
        return Login._read({
          prompt: prompt
        })
          .then(function (selection) {
            var index = parseInt(selection) - 1
            var org = orgs[index]
            return org
          })
      })
  })
}
