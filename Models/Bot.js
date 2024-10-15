const { Schema, model } = require('mongoose')

/**
 * @typedef {Object} Bot
 * @property {string} id
 * @property {boolean} disabled

/**
 * @type {Schema<Bot>}
 */
const botSchema = new Schema({
  id: {
    type: String,
    required: true
  },
  disabled: {
    type: Boolean, 
    default: false
  }
}, { versionKey: false })


exports.Bot = model('Bot', botSchema)