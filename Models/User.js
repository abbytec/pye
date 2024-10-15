const { Schema, model, Types } = require('mongoose')
const redis = require('../redis')

/**
 * @typedef {Object} User
 * @property {string} id
 * @property {number} cash
 * @property {number} bank
 * @property {object} profile
 * @property {Types.ObjectId[]} inventory
 * @property {string} descripcion
 * @property {string} couple
 * @property {array} proposals
 * @property {number} total
 */

/**
 * @type {Schema<User>}
 */
const userSchema = new Schema({
  id: {
    type: String,
    required: true
  },
  cash: {
    type: Number,
    default: 0
  },
  bank: {
    type: Number,
    default: 0
  },
  rob: {
    type: Number,
    default: 0
  },
  bet: {
    type: Number,
    default: 0
  },
  earnings: {
    type: Number,
    default: 0
  },
  couples: {
    type: [Object],
    default: []
  },
  couple: {
    type: String,
    default: 'none'
  },
  description: {
    type: String,
    default: 'Mirame soy una linda mariposa. 🦋'
  },
  profile: {
    type: Object, 
    required: false
  },
  proposals: {
    type: Array,
    default: []
  },
  inventory: {
    type: [Types.ObjectId],
    default: [],
    ref: 'Shop'
  },
  caps: {
    type: Number,
    default: 0
  }
}, { versionKey: false })

userSchema.virtual('total').get(function () {
  return this.cash + this.bank
})

userSchema.post('save', function () {
  redis.sendCommand(['ZADD', 'top:all', this.total.toString(), this.id])
  redis.sendCommand(['ZADD', 'top:cash', this.cash.toString(), this.id])
  redis.sendCommand(['ZADD', 'top:rob', this.rob.toString(), this.id])
  redis.sendCommand(['ZADD', 'top:apostador', (this.earnings - this.bet).toString(), this.id])
  redis.sendCommand(['ZADD', 'top:caps', this.caps.toString(), this.id])
})

userSchema.post('updateOne', function () {
  if (this._update.$inc)
    redis.sendCommand(['ZINCRBY', 'top:all', Object.values(this._update.$inc)[0].toString(), this._conditions.id])
  if (this._update.$inc?.cash)
    redis.sendCommand(['ZINCRBY', 'top:cash', this._update.$inc.cash.toString(), this._conditions.id])
  if (this._update.$inc?.rob)
    redis.sendCommand(['ZINCRBY', 'top:rob', this._update.$inc.rob.toString(), this._conditions.id])
})

userSchema.post('updateMany', function () {
  const tx = redis.multi()
  for (const user of this._conditions.id.$in)
    tx.zIncrBy('top:all', Object.values(this._update.$inc)[0].toString(), user)

  if (this._update.$inc.cash)
    for (const user of this._conditions.id.$in)
      tx.zIncrBy('top:cash', this._update.$inc.cash.toString(), user)

  tx.exec()
})

exports.Users = model('Users', userSchema)