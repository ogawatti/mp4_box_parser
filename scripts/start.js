const path = require('path')
const Mp4BoxParser = require(path.join(__dirname, '../lib/mp4_box_parser.js'))

if (process.argv.length >= 3) {
  let result = Mp4BoxParser.parse(process.argv[2])
  console.log(JSON.stringify(result ,null, '  '));
} else {
  console.log('[Usage] $ npm run start target.mp4')
}
