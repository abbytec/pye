const { Schema, model } = require('mongoose')

/**
 * @typedef {Object} Money
 * @property {string} _id
 * @property {number} voice
 * @property {number} text
 */

/**
 * @type {Schema<Money>}
 */
const moneySchema = new Schema({
  _id: {
    type: String,
    required: true
  },
  bump: {
    type: Number, 
    required: true
  },
  voice: {
    type: Object,
    required: true
  },
  text: {
    type: Object,
    required: true
  }
}, { versionKey: false })


exports.Money = model('Money', moneySchema)