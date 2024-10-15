const { Schema, model } = require('mongoose')

/**
 * @typedef {Object} ModLogs
 * @property {string} id
 * @property {string} moderator
 * @property {string} reason
 *
 */
/**
 * @type {Schema<ModLogs>}
 */
const modlogsSchema = new Schema({
  id: {
    type: String,
    required: true
  },
  moderator: {
    type: String, 
    required: true
  },
  reason: {
    type: String,
    required: true
  },
  date: {
    type: Date,
    required: true
  },
  type: {
    type: String,
    required: true,
    default: 'Timeout'
  }
}, { versionKey: false })


exports.ModLogs = model('ModLogs', modlogsSchema)