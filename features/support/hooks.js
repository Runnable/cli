'use strict'

var Primus = require('primus')
var Promise = require('bluebird')
var basicAuth = require('basic-auth')
var debug = require('debug')('features:hooks')
var dockerFrame = require('docker-frame')
var express = require('express')
var find = require('101/find')
var hasProps = require('101/has-properties')
var http = require('http')
var fs = Promise.promisifyAll(require('fs'))
var uuid = require('uuid')
var substream = require('substream')

module.exports = function () {
  this.Before(function () {
    // file system stuff
    this._fs = {}

    // application server mock
    this.app = makeExpressApp(this)
    this._server = http.createServer(this.app)
    var primusOpts = {
      port: 8080,
      transformer: 'websockets',
      parser: 'JSON'
    }
    var primus = new Primus(this._server, primusOpts)
    primus.use('substream', substream)
    primus.on('connection', function (client) {
      handlePrimusConnection(this, client)
    }.bind(this))

    return Promise.fromCallback(function (callback) {
      this._server.listen(8080, callback)
    }.bind(this))
      .bind(this)
      .then(function () {
        this._fs.baseDir = '/tmp/' + uuid()
        this._fs.cwd = this._fs.baseDir
        return fs.mkdirAsync(this._fs.baseDir)
      })
  })

  this.After(function () {
    return Promise.resolve().bind(this)
      .then(function () {
        if (this._server) {
          return Promise.fromCallback(function (callback) {
            this._server.close(callback)
          }.bind(this))
        }
      })
  })
}

function handlePrimusConnection (ctx, client) {
  client.on('data', function (message) {
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
      container.logs.split('\n').forEach(function (line) {
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
      container.buildLogs.split('\n').forEach(function (line) {
        clientSubstream.write({ type: 'log', content: line })
      })
      clientSubstream.end()
    } else if (message.event === 'terminal-stream') {
      shortHash = message.data.containerId.replace('dc:', '')
      container = find(ctx.containers, hasProps({ shortHash: shortHash }))
      if (!container) { throw new Error('primus: could not find container') }
      if (!container.terminalLogs) { throw new Error('primus: no terminal logs were defined for the container') }
      clientSubstream = client.substream(message.data.terminalStreamId)
      container.terminalLogs.split('\n').forEach(function (line) {
        clientSubstream.write(line + '\n')
      })
    }
  })
}

function makeExpressApp (ctx) {
  var app = express()

  app.post('/instances/:instance/containers/:container/files/',
    require('body-parser').json(),
    function (req, res, next) {
      if (!ctx.fileUploads) { ctx.fileUploads = [] }
      ctx.fileUploads.push(req.body)
      res.status(201)
      res.json({ name: 'test.txt', path: '/fon', isDir: false, content: 'hi\n' })
    }
  )

  app.get('/users/me', function (req, res) {
    res.json({
      accounts: {
        github: {
          username: 'bkendall'
        }
      }
    })
  })

  app.get('/instances', function (req, res) {
    var instances = ctx.containers.map(function (container) {
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
            }
          }
        }
      }
    })
    res.json(instances)
  })

  app.post('/auth/github/token', function (req, res, next) {
    res.status(200).end()
  })

  app.get('/github/user/orgs', function (req, res, next) {
    res.json(ctx.organizations.map(function (o) { return { login: o } }))
  })

  app.post('/authorizations',
    require('body-parser').json(),
    function (req, res, next) {
      debug('here is an authorizations request')
      var user = basicAuth(req)
      if (user.name !== 'bkendall' || user.pass !== 'foobar') {
        return res.status(401).end()
      }
      next()
    },
    function (req, res, next) {
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
    function (req, res) {
      debug('request succeeded')
      res.status(201)
      res.json({
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
      })
    }
  )

  app.get('/docks', function (req, res) {
    res.json(ctx.availableDocks)
  })

  return app
}
