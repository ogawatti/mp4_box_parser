const expect = require('chai').expect
const Mp4BoxParser = require('../index.js')
const path = require('path')

describe('Mp4BoxParser', () => {
  let mp4path = path.join(__dirname, 'test.mp4')

  describe('parse()', () => {
    it ('return object', () => {
      let result = Mp4BoxParser.parse(mp4path)
      expect(result).to.be.an('object')
    })
  })
})
