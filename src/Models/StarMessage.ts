import { Schema, model } from "mongoose";

/**
 * @typedef {Object} StarMessage
 * @property {string} msgId
 */

/**
 * @type {Schema<StarMessage>}
 */
const schemaStarMessage = new Schema({
  msgId: {
    type: String,
    required: true
  },
  responseId: {
    type: String,
    required: true
  }
}, { versionKey: false })

export const StarMessage = model('StarMessage', schemaStarMessage);