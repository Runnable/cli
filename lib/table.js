'use strict'

require('colors')
const Table = require('easy-table')

Table.prototype.toString = function () {
  const cols = this.columns()
  const out = new Table()

  // copy options
  out.separator = this.separator

  // Write header
  cols.forEach((col) => {
    out.cell(col, col.bold)
  })
  out.newRow()
  // out.pushDelimeter(cols)

  // Write body
  out.rows = out.rows.concat(this.rows)

  // Totals
  // if (this.totals && this.rows.length) {
  //   out.pushDelimeter(cols)
  //   this.forEachTotal(out.cell.bind(out))
  //   out.newRow()
  // }

  return out.print()
}

module.exports = Table
