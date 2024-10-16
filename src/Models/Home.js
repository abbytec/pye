const { Schema, model } = require('mongoose')

/**
 * @typedef {Object} Home
 * @property {string} id
 * @property {number} money
 * @property {number} bump
 * @property {number} text
 * @property {number} rep
 * @property {object} house
 * @property {boolean} active
 */

/**
 * @type {Schema<Home>}
 */
const schemaHome = new Schema({
  id: {
    type: String,
    required: true
  },
  name: {
    type: String,
    required: false
  }
  ,
  money: {
    type: Number,
    default: 0
  },
  bump: {
    type: Number,
    default: 0
  },
  text: {
    type: Number,
    default: 0
  },
  rep: {
    type: Number,
    default: 0
  },
  pet: {
    type: String,
    default: 'none'
  },
  level: {
    type: Number,
    default: 1
  },
  house: {
    type: Object,
    default: {
      level: 1,
      color: 'Blanco'
    }
  }, 
  active: {
    type: Boolean,
    default: false
  }, 
  monthly: {
    type: Number,
    default: 0
  }
}, { versionKey: false })
exports.Home = model('Home', schemaHome)