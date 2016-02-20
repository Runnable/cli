'use strict'

require('colors')
var Table = require('easy-table')

module.exports = Table

Table.prototype.toString = function () {
  var cols = this.columns()
  var out = new Table()

  // copy options
  out.separator = this.separator

  // Write header
  cols.forEach(function (col) {
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
