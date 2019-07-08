[![GitHub version](https://badge.fury.io/gh/ogawatti%2Fmp4_box_parser.svg)](https://badge.fury.io/gh/ogawatti%2Fmp4_box_parser)
[![Build Status](https://travis-ci.org/ogawatti/mp4_box_parser.svg)](https://travis-ci.org/ogawatti/mp4_box_parser)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)


# Mp4BoxParser

Parse Mp4 Box.

## Installation

```
$ npm install ogawatti/mp4_box_parser#master
```

## Usage

### require

```
const Mp4BoxParser = require('jpeg_xmp_parser')

let result = Mp4BoxParser.parse('test/test.mp4')
console.log(result)
```

### command line

```
$ npm run start ./test/test.mp4 | jq .
```

## Sample Result

```
{
  "ftyp": {
    "size": 28,
    "type": "ftyp",
    "majorBrand": "mp42",
    "minorVersion": 0,
    "compatibleBrands": [
      "mp42",
      "isom",
      "avc1"
    ]
  },
  "free": {
    "size": 8,
    "type": "free"
  },
  "mdat": {
    "size": 4015575,
    "type": "mdat"
  },
  "moov": {
    "size": 3569,
    "type": "moov",
    "mvhd": {
      "size": 108,
      "type": "mvhd",
      "version": 0,
      "flag": 0,
      "creationTime": 0,
      "modificationTime": 0,
      "timescale": 10000,
      "duration": 73073,
      "nextTrackID": 2
    },
    "trak": [
      {
        "size": 3076,
        "type": "trak",
        "tkhd": {
          "size": 92,
          "type": "tkhd",
          "version": 0,
          "flag": 7,
          "creationTime": 0,
          "modificationTime": 0,
          "trackID": 1,
          "duration": 73073,
          "reserved": 0,
          "layer": 0,
          "alternateGroup": 0,
          "volume": 0,
          "matrix": 7.588550360256754e+81,
          "width": 1280,
          "height": 720
        },
        "edts": {
          "size": 36,
          "type": "edts",
          "elst": {
            "size": 28,
            "type": "elst",
            "version": 0,
            "flag": 0,
            "entryCount": 1
          }
        },
        "mdia": {
          "size": 2940,
          "type": "mdia",
          "mdhd": {
            "size": 32,
            "type": "mdhd",
            "version": 0,
            "flag": 0,
            "timestamp": 0,
            "timescale": 60000,
            "duration": 438438
          },
          "hdlr": {
            "size": 52,
            "type": "hdlr",
            "version": 0,
            "flag": 0,
            "HandlerType": "vide",
            "name": "Video Media Handler"
          },
          "minf": {
            "size": 2848,
            "type": "minf",
            "vmhd": {
              "size": 20,
              "type": "vmhd",
              "version": 0,
              "flag": 1,
              "graphicsmode": 0,
              "opcolor": [
                0,
                0,
                0
              ]
            },
            "dinf": {
              "size": 36,
              "type": "dinf",
              "dref": {
                "size": 28,
                "type": "dref",
                "version": 0,
                "flag": 0,
                "entryCount": 1
              }
            },
            "stbl": {
              "size": 2784,
              "type": "stbl",
              "stsd": {
                "size": 168,
                "type": "stsd",
                "version": 0,
                "flag": 0,
                "entryCount": 1
              },
              "stts": {
                "size": 24,
                "type": "stts",
                "version": 0,
                "flag": 0,
                "entryCount": 1
              },
              "ctts": {
                "size": 1552,
                "type": "ctts",
                "version": 0,
                "flag": 0,
                "entryCount": 192
              },
              "stsc": {
                "size": 64,
                "type": "stsc",
                "version": 0,
                "flag": 0,
                "entryCount": 4
              },
              "stsz": {
                "size": 896,
                "type": "stsz",
                "version": 0,
                "flag": 0,
                "sampleSize": 0,
                "sampleCount": 219,
                "sampleTotal": 0
              },
              "stco": {
                "size": 48,
                "type": "stco",
                "version": 0,
                "flag": 0,
                "entryCount": 8
              },
              "stss": {
                "size": 24,
                "type": "stss",
                "version": 0,
                "flag": 0,
                "entryCount": 2
              }
            }
          }
        }
      }
    ],
    "udta": {
      "size": 217,
      "type": "udta",
      "meta": {
        "size": 209,
        "type": "meta",
        "version": 0,
        "flag": 0,
        "ilst": {
          "size": 163,
          "type": "ilst"
          // ...
        },
        "hdlr": {
          "size": 34,
          "type": "hdlr",
          "version": 0,
          "flag": 0,
          "HandlerType": "mdir",
          "name": ""
        }
      }
    },
    "free": {
      "size": 160,
      "type": "free",
      "data": 0
    }
  }
}
```
