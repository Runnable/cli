'use strict'

const basicAuth = require('basic-auth')
const debug = require('debug')('runnable-cli:features:hooks')
const dockerFrame = require('docker-frame')
const express = require('express')
const find = require('101/find')
const hasProps = require('101/has-properties')
const http = require('http')
const keypather = require('keypather')()
const path = require('path')
const pluck = require('101/pluck')
const Primus = require('primus')
const Promise = require('bluebird')
const substream = require('substream')
const uuid = require('uuid')

const fs = Promise.promisifyAll(require('fs'))

module.exports = function () {
  this.Before(function () {
    // environment stuff
    this.environment = {
      RUNNABLE_HOST: 'http://localhost:8080',
      RUNNABLE_GITHUB_URL: 'http://localhost:8080',
      DEBUG: '' // prevent debug logs from child process
    }

    // file system stuff
    this._fs = {}
    this._fs.baseDir = '/tmp/' + uuid()
    this._fs.cwd = this._fs.baseDir
    this.environment.RUNNABLE_STORE = path.resolve(this._fs.baseDir, '.runnable')

    // application server mock
    this.app = makeExpressApp(this)
    this._server = http.createServer(this.app)
    const primusOpts = {
      port: 8080,
      transformer: 'websockets',
      parser: 'JSON'
    }
    const primus = new Primus(this._server, primusOpts)
    primus.use('substream', substream)
    primus.on('connection', (client) => {
      handlePrimusConnection(this, client)
    })

    return Promise.fromCallback((callback) => {
      this._server.listen(8080, callback)
    })
      .then(() => {
        return fs.mkdirAsync(this._fs.baseDir)
      })
  })

  this.After(function () {
    return Promise.resolve()
      .then(() => {
        if (this._server) {
          return Promise.fromCallback((callback) => {
            this._server.close(callback)
          })
        }
      })
  })
}

function handlePrimusConnection (ctx, client) {
  client.on('data', (message) => {
    var shortHash
    var container
    var clientSubstream
    if (message.event === 'log-stream') {
      var containerId = message.data.containerId
      shortHash = containerId.replace('dc:', '')
      container = find(ctx.containers, hasProps({ shortHash: shortHash }))
      if (!container) { throw new Error('primus: could not find container') }
      if (!container.logs) { throw new Error('primus: no logs were defined for the container') }
      clientSubstream = client.substream(containerId)
      container.logs.split('\n').forEach((line) => {
        line = dockerFrame(1, line)
        line = line.toString('hex')
        clientSubstream.write(line)
      })
    } else if (message.event === 'build-stream') {
      shortHash = message.data.id.split(':').shift()
      container = find(ctx.containers, hasProps({ shortHash: shortHash }))
      if (!container) { throw new Error('primus: could not find container') }
      if (!container.buildLogs) { throw new Error('primus: no build logs were defined for the container') }
      clientSubstream = client.substream(message.data.streamId)
      container.buildLogs.split('\n').forEach((line) => {
        clientSubstream.write({ type: 'log', content: line })
      })
      clientSubstream.end()
    } else if (message.event === 'terminal-stream') {
      shortHash = message.data.containerId.replace('dc:', '')
      container = find(ctx.containers, hasProps({ shortHash: shortHash }))
      if (!container) { throw new Error('primus: could not find container') }
      if (!container.terminalLogs) { throw new Error('primus: no terminal logs were defined for the container') }
      clientSubstream = client.substream(message.data.terminalStreamId)
      container.terminalLogs.split('\n').forEach((line) => {
        clientSubstream.write(line + '\n')
      })
    }
  })
}

function makeExpressApp (ctx) {
  const app = express()

  app.post('/instances/:instance/containers/:container/files/',
    require('body-parser').json(),
    (req, res, next) => {
      if (!ctx.fileUploads) { ctx.fileUploads = [] }
      ctx.fileUploads.push(req.body)
      res.status(201)
      res.json({ name: 'test.txt', path: '/fon', isDir: false, content: 'hi\n' })
    }
  )

  app.get('/users/me', (req, res) => {
    res.json({
      accounts: {
        github: {
          username: 'bkendall'
        }
      }
    })
  })

  app.get('/instances', (req, res) => {
    var instances = ctx.containers.map((container) => {
      var instanceId = uuid()
      var contextId = uuid()
      var contextVersionId = container.shortHash + ':' + uuid()
      var appCodeVersionId = uuid()

      var fullRepo = container.org + '/' + container.repo
      var appCodeVersions = []
      if (container.org && container.repo) {
        appCodeVersions.push({
          _id: appCodeVersionId,
          branch: container.branch,
          lowerBranch: container.branch.toLowerCase(),
          repo: fullRepo,
          lowerRepo: fullRepo.toLowerCase()
        })
      }
      return {
        _id: instanceId,
        shortHash: container.shortHash,
        name: container.name,
        lowerName: container.name.toLowerCase(),
        contextVersion: {
          _id: contextVersionId,
          context: contextId,
          appCodeVersions: appCodeVersions
        },
        container: {
          dockerContainer: 'dc:' + container.shortHash,
          inspect: {
            State: {
              Status: container.status.toLowerCase(),
              Running: container.status === 'Running'
            },
            Config: {
              WorkingDir: '/working-dir'
            }
          }
        }
      }
    })
    var repo = keypather.get(req.query, '["contextVersion.appCodeVersions.repo"].toLowerCase()')
    debug('check this repo out: ' + repo)
    if (repo) {
      instances = instances.filter((i) => {
        return keypather.get(i, 'contextVersion.appCodeVersions[0].lowerRepo') === repo
      })
    }
    var name = keypather.get(req.query, 'name.toLowerCase()')
    if (name) {
      instances = instances.filter((i) => {
        return i.lowerName === name
      })
    }
    debug('returning named instances: ' + instances.map(pluck('lowerName')).join(', '))
    res.json(instances)
  })

  app.post('/auth/github/token', (req, res, next) => {
    res.status(200).end()
  })

  app.get('/github/user/orgs', (req, res, next) => {
    res.json(ctx.organizations.map((o) => { return { login: o } }))
  })

  app.post('/authorizations',
    require('body-parser').json(),
    (req, res, next) => {
      debug('here is an authorizations request')
      var user = basicAuth(req)
      debug('authorization is as follows', user.name, user.pass)
      if (!user) {
        return res.status(403).end()
      }
      if (user.name !== 'bkendall' || user.pass !== 'foobar') {
        return res.status(401).end()
      }
      req._user = user.name
      next()
    },
    (req, res, next) => {
      if (ctx.requiredOTP) {
        var code = req.headers['x-github-otp']
        if (!code) {
          res.set('x-github-otp', 'required')
          debug('request failed. need otp')
          return res.status(401).end()
        }
        if (code !== ctx.requiredOTP) {
          debug('request failed', code, ctx.requiredOTP)
          return res.status(401).end()
        }
      }
      next()
    },
    (req, res) => {
      debug('request succeeded')
      ctx.lastGeneratedToken = {}
      ctx.lastGeneratedToken[req._user] = {
        id: 1000000,
        url: 'https://api.github.com/authorizations/1000000',
        app: {
          name: req.body.note,
          url: 'https://developer.github.com/v3/oauth_authorizations/',
          client_id: '00000000000000000000'
        },
        token: 'tokentokentoken123',
        hashed_token: 'hashedtoken456',
        token_last_eight: 'token123',
        note: req.body.note,
        note_url: null,
        created_at: '2016-02-18T02:31:37Z',
        updated_at: '2016-02-18T02:31:37Z',
        scopes: req.body.scopes,
        fingerprint: null
      }
      res.status(201)
      res.json(ctx.lastGeneratedToken[req._user])
    }
  )

  app.get('/docks', (req, res) => {
    res.json(ctx.availableDocks)
  })

  return app
}
