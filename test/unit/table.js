'use strict'

require('colors')
const assert = require('chai').assert

const Table = require('../../lib/table')

describe('Table Generator', () => {
  it('should format data as we expect', () => {
    const data = [
      { Container: 'api/master', State: 'Running', 'Container URL': 'akdo1.runnableapp.com' },
      { Container: 'api/anton-test', State: 'Running', 'Container URL': 'akdo2.runnableapp.com' },
      { Container: 'api/better-fatal-errors', State: 'Building', 'Container URL': 'akdo3.runnableapp.com' }
    ]

    const expected = [
      'Container'.bold + '                ' + 'State'.bold + '     ' + 'Container URL'.bold,
      'api/master               Running   akdo1.runnableapp.com',
      'api/anton-test           Running   akdo2.runnableapp.com',
      'api/better-fatal-errors  Building  akdo3.runnableapp.com',
      ''
    ]

    const actual = Table.print(data).split('\n').map(function (s) { return s.trim() })
    assert.deepEqual(actual, expected)
  })
})
