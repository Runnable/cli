'use strict'

const assign = require('101/assign')
const debug = require('debug')('runnable-cli:features:steps')
const find = require('101/find')
const findIndex = require('101/find-index')
const hasProps = require('101/has-properties')
const path = require('path')
const Promise = require('bluebird')
const spawn = require('child_process').spawn

const execFile = Promise.promisify(require('child_process').execFile, { multiArgs: true })
const fs = Promise.promisifyAll(require('fs'))

const executablePath = path.join(__dirname, '..', 'bin', 'runnable.js')

module.exports = function () {
  this.Given(/^the latest version is (the same as|newer than) mine$/, function (direction) {
    this.latestModuleVersion = require('../package.json').version
    if (direction === 'newer than') {
      this.latestModuleVersion = '1' + this.latestModuleVersion
    }
  })

  this.Given(/^I am using the "([^"]*)" organization$/, function (org) {
    const settingsFile = path.resolve(this.environment.RUNNABLE_STORE, 'settings.json')
    return createDirectory(this, '.runnable')
      .bind(this)
      .delay(100)
      .then(function () {
        return fs.writeFileAsync(
          settingsFile,
          JSON.stringify({ organization: org })
        )
      })
      .delay(100)
      .then(function () {
        return expectOrganization(this, org)
      })
  })

  this.Given(/^I am part of the "([^"]*)" organization$/, function (org) {
    if (!this.organizations) {
      this.organizations = []
    }
    this.organizations.push(org)
  })

  function expectOrganization (ctx, expectedOrganization) {
    const settingsFile = path.resolve(ctx.environment.RUNNABLE_STORE, 'settings.json')
    return fs.readFileAsync(settingsFile)
      .then(function (data) {
        const settings = JSON.parse(data)
        if (settings.organization !== expectedOrganization) {
          throw new Error('Expected organization to be:\n' + expectedOrganization + '\n' +
            'Got:\n' + settings.organization + '\n')
        }
      })
  }

  this.Then(/^there should be a token generated for "([^"]*)"$/, function (username) {
    if (!this.lastGeneratedToken[username]) {
      throw new Error('Expected token to be generated for ' + username + '. Did not find one.')
    }
  })

  this.Given(/^I should be using the "([^"]*)" organization$/, function (expectedOrg) {
    expectOrganization(this, expectedOrg)
  })

  this.Given(/^the( non-repository)? containers:$/, function (nonRepo, table) {
    if (!this.containers) { this.containers = [] }
    table.hashes().forEach(function (c) {
      if (!nonRepo) {
        const r = c.repo.split('/')
        c.org = r[0]
        c.repo = r[1]
      }
      this.containers.push(c)
    }.bind(this))
  })

  function createDirectory (ctx, dir) {
    if (dir.indexOf('/') === -1) {
      return fs.mkdirAsync(path.join(ctx._fs.cwd, dir))
    } else {
      let currDir = ctx._fs.cwd
      return Promise.each(
        dir.split('/'),
        function (newDir) {
          currDir = path.join(currDir, newDir)
          return fs.mkdirAsync(currDir)
        }
      )
    }
  }

  this.Given(/^I have a local file named "([^"]*)" containing:$/, function (name, content) {
    return fs.writeFileAsync(
      path.resolve(this._fs.cwd, name),
      content
    )
  })

  this.Then(/^the file "([^"]*)" should have been uploaded to "([^"]*)"$/, function (name, path) {
    if (!this.fileUploads) {
      throw new Error('there was no files uploaded to the server')
    }
    const file = find(this.fileUploads, hasProps({ name: name }))
    if (!file) {
      throw new Error('there was no file named "' + name + '" uploaded to the server')
    }
    if (file.path !== path) {
      throw new Error('there was no file with path "' + path + '" uploaded to the server')
    }
  })

  function createRepository (ctx, dir) {
    const prevDir = ctx._fs.cwd
    return createDirectory(ctx, dir)
      .then(function () { return runCommand(ctx, 'git init ' + dir) })
      .then(function () { return moveToDirectory(ctx, dir) })
      .then(function () { return runCommand(ctx, 'git config user.email "foo@example.com"') })
      .then(function () { return runCommand(ctx, 'git config user.name "Foo"') })
      .then(function () { return runCommand(ctx, 'touch README.md') })
      .then(function () { return runCommand(ctx, 'git add README.md') })
      .then(function () { return runCommand(ctx, 'git commit -m "init"') })
      .then(function () { return moveToDirectory(ctx, prevDir) })
  }

  function moveToDirectory (ctx, dir) {
    ctx._fs.cwd = path.resolve(ctx._fs.cwd, dir)
  }

  function addRemoteOrigin (ctx, repo) {
    const newUrl = 'git@github:' + repo + '.git'
    return runCommand(ctx, 'git remote add origin ' + newUrl)
  }

  this.Given(/^I am in the "([^"]*)" git repository$/, function (repo) {
    return createRepository(this, repo).bind(this)
      .then(function () { return moveToDirectory(this, repo) })
      .then(function () {
        if (repo.indexOf('/') > -1) {
          return addRemoteOrigin(this, repo)
        }
      })
  })

  this.Given(/^I am on branch "([^"]*)"$/, function (branch) {
    return runCommand(this, 'git checkout -b ' + branch)
  })

  this.Given(/^the container named "([^"]*)" has (run|build|terminal) logs:$/, function (containerName, logType, logs) {
    const containerIndex = findIndex(this.containers, hasProps({ name: containerName }))
    if (containerIndex === -1) {
      throw new Error('steps: container ' + containerName + ' does not exist')
    }
    if (logType === 'run') {
      this.containers[containerIndex].logs = logs
    } else if (logType === 'build') {
      this.containers[containerIndex].buildLogs = logs
    } else if (logType === 'terminal') {
      this.containers[containerIndex].terminalLogs = logs
    } else {
      throw new Error('somehow I do not know where to build these logs')
    }
  })

  this.When(/^I run `([^`]*)` interactively$/, function (command) {
    this.lastRun = {}
    const stdoutArr = []
    const stderrArr = []
    const args = command.split(/\s+/)
    command = args.shift()
    if (command === 'runnable') { command = executablePath }
    const env = assign({}, process.env, this.environment)
    this.childProcess = spawn(command, args, { env: env, cwd: this._fs.cwd })
    this.childProcess.stdout.on('data', Array.prototype.push.bind(stdoutArr))
    this.childProcess.stderr.on('data', Array.prototype.push.bind(stderrArr))
    this.childProcess.on('error', function (err) {
      this.lastRun.error = err
    }.bind(this))
    this.childProcess.on('close', function () {
      this.lastRun.stdout = Buffer.concat(stdoutArr)
      this.lastRun.stderr = Buffer.concat(stderrArr)
      debug('stdout:', this.lastRun.stdout.toString())
      debug('stderr:', this.lastRun.stderr.toString())
    }.bind(this))
    debug('child pid:', this.childProcess.pid)
    return Promise.resolve().delay(process.env._STEP_DELAY_MS || 1000)
  })

  this.Given(/^I require a two\-factor code "([^"]*)"$/, function (code) {
    this.requiredOTP = code
  })

  this.When(/^I finished my input$/, function () {
    const finishPromise = new Promise(function (resolve) {
      this.childProcess.stdin.on('finish', resolve)
    }.bind(this))
    this.childProcess.stdin.end()
    return finishPromise.delay(process.env._STEP_DELAY_MS || 500)
  })

  this.When(/^I type "([^"]*)"$/, function (input) {
    input = input.trim()
    this.childProcess.stdin.setEncoding = 'utf-8'
    const flushed = this.childProcess.stdin.write(input + '\r\n')
    debug('stdin flushed?', flushed)
    if (flushed) {
      return Promise.resolve().delay(process.env._STEP_DELAY_MS || 2000)
    } else {
      return new Promise(function (resolve) {
        this.childProcess.stdin.on('drain', resolve)
      }.bind(this)).delay(process.env._STEP_DELAY_MS || 1000)
    }
  })

  function runCommand (ctx, command) {
    const env = assign({}, process.env, ctx.environment)
    const args = command.split(/\s+/)
    command = args.shift()
    debug('running:', command, args)
    debug('in cwd:', ctx._fs.cwd)
    return execFile(command, args, { env: env, cwd: ctx._fs.cwd })
  }

  function runCommandSaveOutput (ctx, command) {
    ctx.lastRun = {}
    return runCommand(ctx, command)
      .spread(function (stdout, stderr) {
        ctx.lastRun = {
          stdout: stdout,
          stderr: stderr
        }
        debug('stdout:', stdout.toString())
        debug('stderr:', stderr.toString())
      })
      .catch(function (err) {
        ctx.lastRun.error = err
        debug('error:', err)
      })
  }

  this.When(/^I( successfully)? run `runnable (.+)`$/, function (success, args) {
    const run = runCommandSaveOutput(this, executablePath + ' ' + args)
    if (success) {
      return run.bind(this)
        .then(function () { return expectExitCode(this, 0) })
        .then(function () { return expectEmptyErrorOutput(this) })
    } else {
      return run
    }
  })

  this.When(/^I wait (\d+) seconds?$/, function (seconds) {
    return Promise.delay(seconds * 1000)
  })

  this.When(/^I send Ctrl\+C$/, function () {
    const closePromise = new Promise(function (resolve) {
      this.childProcess.on('close', resolve)
    }.bind(this))
    this.childProcess.kill('SIGINT')
    return closePromise.delay(process.env._STEP_DELAY_MS || 500)
  })

  function outputContain (not, expectedOutput) {
    return Promise.try(function () {
      const actualOutput = this.lastRun.stdout
      const actualIndex = actualOutput.indexOf(expectedOutput)
      debug('output expected', expectedOutput)
      debug('output received', actualOutput.toString())
      if (not ? (actualIndex !== -1) : (actualIndex === -1)) {
        throw new Error('Expected output to contain the following:\n' + expectedOutput + '\n' +
          'Got:\n' + actualOutput + '\n')
      }
    }.bind(this))
  }

  this.Then(/^the output should( not)? contain "([^"]*)"$/, outputContain)
  this.Then(/^the output should( not)? contain:$/, outputContain)

  function outputMatch (not, expectedRegExp) {
    const self = this
    return Promise.try(function () {
      const actualOutput = self.lastRun.stdout
      expectedRegExp = new RegExp(expectedRegExp)

      const matches = expectedRegExp.test(actualOutput)
      if (not ? matches : !matches) {
        throw new Error('Expected output to ' + (not ? 'not' : '') + ' match the following:\n' + expectedRegExp + '\n' +
          'Got:\n' + actualOutput + '\n')
      }
    })
  }

  this.Then(/^the output should( not)? match:$/, outputMatch)
  this.Then(/^the output should( not)? match "([^"]*)"$/, outputMatch)

  function expectEmptyErrorOutput (ctx) {
    return Promise.try(function () {
      const actualOutput = ctx.lastRun.stderr
      if (actualOutput.toString() !== '') {
        throw new Error('Expected error output to be empty.\nGot:\n' + actualOutput + '\n')
      }
    })
  }

  this.Then(/^the error output should be empty$/, function () {
    return expectEmptyErrorOutput(this)
  })

  function expectExitCode (ctx, expectedCode) {
    return Promise.try(function () {
      const actualCode = ctx.lastRun.error ? ctx.lastRun.error.code : 0
      const okay = actualCode === 0
      if (!okay) {
        throw new Error('Expected exit code: ' + expectedCode + '\n' +
          'Got: ' + actualCode + '\n')
      }
    })
  }

  this.Then(/^the exit status should be (\d+)$/, function (expectedCode) {
    return expectExitCode(this, expectedCode)
  })
}
