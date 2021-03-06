# Runnable CLI

[![Travis](https://img.shields.io/travis/Runnable/cli/master.svg?style=flat-square)](https://travis-ci.org/Runnable/cli)
[![Coveralls branch](https://img.shields.io/coveralls/Runnable/cli/master.svg?style=flat-square)](https://coveralls.io/github/Runnable/cli?branch=master)
[![js-standard-style](https://img.shields.io/badge/code%20style-standard-brightgreen.svg?style=flat-square)](http://standardjs.com/)
[![npm (scoped)](https://img.shields.io/npm/v/@runnable/cli.svg?style=flat-square)](https://www.npmjs.com/package/@runnable/cli)

A CLI for Runnable.

## Requirements

To use the CLI, you need:

* nodejs `v4.2.x` or above
* npm `v2.7` or above

## Installation

To install the CLI, run `npm install -g @runnable/cli`.

## Commands

### `runnable login`

Use this command to authenticate your CLI session in your terminal. You will also be prompted to choose a Github organization. You can change the Github organization at any time using `runnable org`.

### `runnable org`

Use this command to change the active Github organization in your session.

### `runnable ssh [name]`

Use this command to spawn a shell session into the container. You can specify the name of the container you are trying to reach in the following format: `<reponame>/<branchname>`.

If you don't provide a name, the cli will automatically map the command you are trying to run to the repo/branch your current working directory is on.

### `runnable logs [name] [--build|--cmd]`

Use this command to view the logs of a container. You can specify the name of the container you are trying to reach in the following format: `<reponame>/<branchname>`. 

If you don't provide a name, the cli will automatically map the command you are trying to run to the repo/branch your local directory is on.

You can choose to view the build logs by adding the `-b` argument to the command. Conversely, you can view the CMD logs by adding the `-c` argument to the command. If you don't specify the aforementioned commands, the command will just follow the real time logs of the Container.

### `runnable list [reponame]`

Use this command to get an overview of all the different containers you have under the active Github organization.

You can drill down and list all the branches of a repository by specifying a repository name.

### `runnable upload <file>`

Use this command to upload a file to the repository. The file will be placed on the root of the repository folder on the container. 
