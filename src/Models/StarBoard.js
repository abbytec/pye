const { Schema, model } = require('mongoose')

/**
 * @typedef {Object} StarBoard
 * @property {string} id
 * @property {string} channel
 * @property {number} stars
 */

/**
 * @type {Schema<StarBoard>}
 */
const schemaStarBoard = new Schema({
  id: {
    type: String,
    required: true
  },
  channel: {
    type: String,
    required: true
  },
  stars: {
    type: Number,
    default: 4
  }
}, { versionKey: false })

exports.StarBoard = model('StarBoard', schemaStarBoard)