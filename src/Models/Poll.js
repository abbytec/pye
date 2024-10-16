const { Schema, model } = require('mongoose')

/**
 * @typedef {Object} Money
 * @property {string} msgId
 * @property {number} timestamp
 * @property {array} options
 */

/**
 * @type {Schema<Poll>}
 */
const pollSchema = new Schema({
  msgId: {
    type: String,
    required: true
  }, 
  timestamp: {
    type: Number,
    required: true
  }, 
  options: {
    type: Array,
    required: true
  },
  img: {
    type: String,
  }
  
}, { versionKey: false })


exports.Poll = model('Poll',pollSchema)