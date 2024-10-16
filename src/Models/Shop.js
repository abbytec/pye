const { Schema, model } = require('mongoose')

/**
 * @typedef {Object} Shop
 * @property {string} name
 * @property {number} price
 * @property {string} description
 * @property {string} message
 * @property {boolean} storable
 * @property {string} role
 * @property {number} timeout 
 * @property {string} group
 */

/**
 * @type {Schema<Shop>}
 */
const schemaShop = new Schema({
  name: {
    type: String,
    required: true
  },
  itemId: {
    type: String,
    required: true
  },
  price: {
    type: Number,
    required: true
  },
  description: {
    type: String,
    required: true
  },
  message: {
    type: String,
    default: ''
  },
  storable: {
    type: Boolean,
    required: true
  },
  icon: {
    type: String,
    default: ''
  },
  role: {
    type: String,
    default: ''
  },
  timeout: {
    type: Number,
    default: 0
  },
  group: {
    type: String,
    default: ''
  }
}, { versionKey: false })

exports.Shop = model('Shop', schemaShop)