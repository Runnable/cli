'use strict'

require('colors')
const os = require('os')
const pluck = require('101/pluck')
const Promise = require('bluebird')
const request = require('request')
const url = require('url')
const isNumber = require('101/is-number')

const Runnable = require('./runnable')

const read = Promise.promisify(require('read'))

class Login extends Runnable {
  static login (args) {
    return Login._read({ prompt: 'GitHub username:' })
      .then((username) => {
        return Login._read({
          prompt: 'GitHub password:',
          silent: true,
          replace: '*'
        })
          .then((password) => {
            return { user: username, pass: password }
          })
      })
      .then((creds) => {
        return Login._makeRequest(creds)
          .spread((res, body) => {
            const otpHeader = res.headers['x-github-otp']
            if (otpHeader && otpHeader.indexOf('required') > -1) {
              return Login._read({
                prompt: 'Two-factor code:',
                silent: true,
                replace: '*'
              })
                .then((otp) => {
                  return Login._makeRequest(creds, otp)
                })
            } else {
              return [ res, body ]
            }
          })
      })
      .spread((res, body) => {
        if (res.statusCode !== 201) {
          throw new Error(`(from GitHub) ${body.message}`)
        }
        if (!body.token) {
          throw new Error('No github token received')
        }
        return Promise.fromCallback((callback) => {
          Login.user.githubLogin(body.token, callback)
        })
      })
      .then(() => {
        Login._output('Authenticated!')
      })
  }

  static _makeRequest (creds, token) {
    const githubURL = process.env.RUNNABLE_GITHUB_URL || 'https://api.github.com'
    const parsedURL = url.parse(githubURL)
    parsedURL.pathname = '/authorizations'
    const targetURL = url.format(parsedURL)
    const opts = {
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
    return Promise.fromCallback((callback) => {
      request.post(targetURL, opts, callback)
    }, { multiArgs: true })
  }

  static chooseOrg (args) {
    return Promise.fromCallback(function (callback) {
      Login.user.fetchGithubOrgs(callback)
    })
      .then(function (orgsData) {
        return orgsData.map(pluck('login')).sort()
      })
      .then(function promptForOrg (orgs) {
        const orgList = orgs.map((o, i) => {
          return `  ${i + 1}) ${o}`
        })
        const rangeString = `[1-${orgList.length}]`
        const prompt = [
          'Choose a GitHub organization to use with Runnable ' + rangeString,
          '',
          orgList.join('\n'),
          '',
          '>'
        ].join('\n')
        return Login._read({
          prompt: prompt
        })
          .then((selection) => {
            let index = parseInt(selection, 10) - 1
            if (!isNumber(index)) {
              index = orgs.map((o) => { return o.toLowerCase() })
                .indexOf(selection.toString().toLowerCase())
            }
            const org = orgs[index]
            if (!org) {
              Login._output([
                '',
                'Could not parse your selection. Try again?'.bold.red,
                ''
              ].join('\n'))
              return promptForOrg(orgs)
            } else {
              return org
            }
          })
      })
      .then(function (org) {
        Login._output('Selected organization:'.green, org)
        return org
      })
  }
}

Login._read = read
Login._output = console.log

module.exports = Login
