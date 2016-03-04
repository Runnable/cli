#!/usr/bin/env node
'use strict'

const debug = require('debug')('runnable-cli:cli')
const program = require('commander')

const Runnable = require('../lib/runnable')

program
  .version(require('../package.json').version)
  .usage('[options] <command>')
  .command('list [repository]', 'Lists all repositories and services. Specify a repository to list its containers.')
  .command('log [repository]', 'View the logs of the container for your local branch.')
  .command('logs [repository]', 'Alias of `log [repository]`', { noHelp: true })
  .command('login', 'Authenticate with Runnable CLI.')
  .command('org', 'Choose a GitHub organization to use with Runnable.')
  .command('ssh', 'Starts a terminal session on the container for your local branch.')
  .command('upload', 'Upload a file to the container for your local branch.')

const isLogin = process.argv.indexOf('login') !== -1
const isHelp = process.argv.indexOf('--help') !== -1 ||
  process.argv.indexOf('help') !== -1 ||
  process.argv.length === 0

if (isLogin || isHelp) {
  program.parse(process.argv)
} else {
  Runnable.user.fetch('me', (err) => {
    if (err) {
      console.error('Not authorized. Please login.')
      program.help()
    } else {
      program.parse(process.argv)

      if (program.runningCommand) {
        program.runningCommand.on('exit', () => {
          debug('child process stopped')
        })
        process.on('SIGINT', () => {
          debug('SIGINT received. passing to child.')
          program.runningCommand.kill('SIGINT')
        })
      }
    }
  })
}
