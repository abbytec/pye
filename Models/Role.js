const { Schema, model } = require('mongoose')

/**
 * @typedef {Object} UserRole
 * @property {string} id
 * @property {string} roleId
 * @property {number} time
 * @property {string} count
 */

/**
 * @type {Schema<UserRole>}
 */
const schemaUserRole = new Schema({
  id: {
    type: String,
    required: true
  },
  rolId: {
    type: String,
    required: true
  },
  guildId:{
    type: String,
    required: true
  },
  count: {
    type: Number,
    required: true
  }
}, { versionKey: false })

exports.UserRole = model('UserRole', schemaUserRole)