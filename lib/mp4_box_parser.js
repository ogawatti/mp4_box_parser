const fs = require('fs')

module.exports = class Mp4BoxParser {
  static parse(filePath) {
    let fd = fs.openSync(filePath, 'r')
    let position = 0

    let fstat = fs.fstatSync(fd)
    let box = this.parseBox(fd, position, fstat.size)

    fs.closeSync(fd)
    return box
  }

  static get hasChildBoxes() {
    return [ 'moov', 'edts', 'mdia', 'minf', 'dinf', 'stbl', 'udta' ]
  }

  static get existsBothBoxes() {
    return [ 'trak' ]
  }

  static parseBox(fd, position, boxSize) {
    let box = {}
    let parsedBox

    while (position + 8 < boxSize) {
      let { size, type } = this._readSizeAndType(fd, position)
          
      if (this.hasChildBoxes.includes(type)) {
        // ChildBox を見に行く場合
        parsedBox = this.parseBox(fd, position + 8, position + size)
        box[type] = Object.assign({ size: size, type: type }, parsedBox)
        position += size
      } else if (this.existsBothBoxes.includes(type)) {
        // 同一階層に複数同じTypeがあり、配列で返す場合
        parsedBox = this.parseBox(fd, position + 8, position + size)
        parsedBox = Object.assign({ size: size, type: type }, parsedBox)
        if (!box[type]) { box[type] = [] }
        box[type].push(parsedBox)
        position += size
      } else if (type === 'uuid') {
        // 同一階層に複数同じTypeがあり、特定のキーで分ける場合
        let uuidBox = this.parseBox_xxxx(size, type, fd, position)
        let uuid = Object.keys(uuidBox)[0]
        parsedBox = this.parseBox(fd, position + 8 + 16, position + size)
        Object.assign(uuidBox[uuid], parsedBox)
        if (!box[type]) { box[type] = {} }
        box[type] = Object.assign(box[type], uuidBox)
        position += size
      } else {
        // それ以外の場合は同一階層の次のBoxを見に行く
        box[type] = this.parseBox_xxxx(size, type, fd, position)
        position += size
      }
    }

    return box
  }

  static parseBox_xxxx(size, type, fd, position) {
    let functionName = `parseBox_${type}`
    if (this[functionName]) {
      return this[functionName](size, type, fd, position)
    } else {
      return { size: size, type: type }
    }
  }

  static parseBox_ftyp(size, type, fd, position) {
    let box = { size: size, type: type }
    let buffer
    position += 8

    buffer = this._readBytes(fd, position, 4)
    box.majorBrand = this._buffer2string(buffer)
    position += 4

    buffer = this._readBytes(fd, position, 4)
    box.minorVersion = this._buffer2integer(buffer)
    position += 4

    box.compatibleBrands = []
    let endPosition = position - 16 + size
    while (position < endPosition) {
      buffer = this._readBytes(fd, position, 4)
      box.compatibleBrands.push(this._buffer2string(buffer))
      position += 4
    }

    return box
  }

  static parseFullBox(size, type, fd, position) {
    let box = { size: size, type: type }
    let buffer
    position += 8

    buffer = this._readBytes(fd, position, 1)
    box.version = buffer[0]
    position += 1

    buffer = this._readBytes(fd, position, 3)
    box.flag = this._buffer2integer(buffer)
    position += 3

    return { box, position }
  }

  static parseBox_mvhd(size, type, fd, position) {
    let box, buffer
    ({ box, position } = this.parseFullBox(size, type, fd, position))

    if (box.version === 1) {
      buffer = this._readBytes(fd, position, 8)
      box.creationTime = this._buffer2integer(buffer)
      position += 8

      buffer = this._readBytes(fd, position, 8)
      box.modificationTime = this._buffer2integer(buffer)
      position += 8

      buffer = this._readBytes(fd, position, 4)
      box.timescale = this._buffer2integer(buffer)
      position += 4

      buffer = this._readBytes(fd, position, 8)
      box.duration = this._buffer2integer(buffer)
      position += 8
    } else {
      buffer = this._readBytes(fd, position, 4)
      box.creationTime = this._buffer2integer(buffer)
      position += 4

      buffer = this._readBytes(fd, position, 4)
      box.modificationTime = this._buffer2integer(buffer)
      position += 4

      buffer = this._readBytes(fd, position, 4)
      box.timescale = this._buffer2integer(buffer)
      position += 4

      buffer = this._readBytes(fd, position, 4)
      box.duration = this._buffer2integer(buffer)
      position += 4
    }

    buffer = this._readBytes(fd, position, 4)
    //box.rate = this._buffer2integer(buffer)
    position += 4

    buffer = this._readBytes(fd, position, 2)
    //box.volume = this._buffer2integer(buffer)
    position += 2

    buffer = this._readBytes(fd, position, 2 + 4 * 2)
    //box.reserved = this._buffer2integer(buffer)
    position += 2 + 4 * 2

    buffer = this._readBytes(fd, position, 4 * 9)
    //box.matrix = this._buffer2integer(buffer)
    position += 4 * 9

    buffer = this._readBytes(fd, position, 4 * 6)
    //box.predefined = this._buffer2integer(buffer)
    position += 4 * 6

    buffer = this._readBytes(fd, position, 4)
    box.nextTrackID = this._buffer2integer(buffer)
    position += 4

    return box
  }

  static parseBox_tkhd(size, type, fd, position) {
    let box, buffer
    ({ box, position } = this.parseFullBox(size, type, fd, position))

    if (box.version === 1) {
      buffer = this._readBytes(fd, position, 8)
      box.creationTime = this._buffer2integer(buffer)
      position += 8

      buffer = this._readBytes(fd, position, 8)
      box.modificationTime = this._buffer2integer(buffer)
      position += 8

      buffer = this._readBytes(fd, position, 4)
      box.trackID = this._buffer2integer(buffer)
      position += 4

      buffer = this._readBytes(fd, position, 4)
      //box.reserved = this._buffer2integer(buffer)
      position += 4

      buffer = this._readBytes(fd, position, 8)
      box.duration = this._buffer2integer(buffer)
      position += 8
    } else {
      buffer = this._readBytes(fd, position, 4)
      box.creationTime = this._buffer2integer(buffer)
      position += 4

      buffer = this._readBytes(fd, position, 4)
      box.modificationTime = this._buffer2integer(buffer)
      position += 4

      buffer = this._readBytes(fd, position, 4)
      box.trackID = this._buffer2integer(buffer)
      position += 4

      buffer = this._readBytes(fd, position, 4)
      //box.reserved = this._buffer2integer(buffer)
      position += 4

      buffer = this._readBytes(fd, position, 4)
      box.duration = this._buffer2integer(buffer)
      position += 4
    }

    buffer = this._readBytes(fd, position, 4 * 2)
    box.reserved = this._buffer2integer(buffer)
    position += 4 * 2

    buffer = this._readBytes(fd, position, 2)
    box.layer = this._buffer2integer(buffer)
    position += 2

    buffer = this._readBytes(fd, position, 2)
    box.alternateGroup = this._buffer2integer(buffer)
    position += 2

    buffer = this._readBytes(fd, position, 2)
    box.volume = this._buffer2integer(buffer)
    position += 2

    buffer = this._readBytes(fd, position, 2)
    box.reserved = this._buffer2integer(buffer)
    position += 2

    buffer = this._readBytes(fd, position, 4 * 9)
    box.matrix = this._buffer2integer(buffer)
    position += 4 * 9

    buffer = this._readBytes(fd, position, 4)
    box.width = this._buffer2integer(buffer.slice(0,2))
    position += 4

    buffer = this._readBytes(fd, position, 4)
    box.height = this._buffer2integer(buffer.slice(0,2))
    position += 4

    return box
  }

  static parseBox_hdlr(size, type, fd, position) {
    let endPosition = position + size
    let box, buffer
    ({ box, position } = this.parseFullBox(size, type, fd, position))

    buffer = this._readBytes(fd, position, 4)
    //box.preDefined = this._buffer2integer(buffer)
    position += 4

    buffer = this._readBytes(fd, position, 4)
    box.HandlerType = this._buffer2string(buffer)
    position += 4

    buffer = this._readBytes(fd, position, 4 * 3)
    //box.reserved = this._buffer2integer(buffer)
    position += 4 * 3

    // null文字まで
    buffer = this._readBytes(fd, position, endPosition - position)
    let nullIndex = buffer.findIndex(ascii => ascii === 0x00)
    let target = buffer.slice(0, nullIndex)
    box.name = this._buffer2string(target)

    return box
  }

  static parseBox_elst(size, type, fd, position) {
    let box, buffer
    ({ box, position } = this.parseFullBox(size, type, fd, position))

    buffer = this._readBytes(fd, position, 4)
    box.entryCount = this._buffer2integer(buffer)
    position += 4

    box.entry = []
    for (let i = 1; i <= box.entryCount; i++) {
      let entryBox = {}

      if (box.version === 1) {
        buffer = this._readBytes(fd, position, 8)
        entryBox.segmentDuration = this._buffer2integer(buffer)
        position += 8

        buffer = this._readBytes(fd, position, 8)
        entryBox.mediaTime = this._buffer2integer(buffer)
        position += 8
      } else {
        buffer = this._readBytes(fd, position, 4)
        entryBox.segmentDuration = this._buffer2integer(buffer)
        position += 4

        buffer = this._readBytes(fd, position, 4)
        entryBox.mediaTime = this._buffer2integer(buffer)
        position += 4
      }

      buffer = this._readBytes(fd, position, 2)
      entryBox.mediaRateInteger = this._buffer2integer(buffer)
      position += 2

      buffer = this._readBytes(fd, position, 2)
      entryBox.mediaRateFraction = this._buffer2integer(buffer)
      position += 2

      box.entry.push(entryBox)
    }

    return box
  }

  static parseBox_uuid(size, type, fd, position) {
    let buffer = this._readBytes(fd, position + 4 + 4, 16)
    let uuid = this._buffer2uuid(buffer)
    let box = {}
    box[uuid] = { size: size, type: type }
    return box
  }

  static parseBox_mdhd(size, type, fd, position) {
    let box, buffer
    ({ box, position } = this.parseFullBox(size, type, fd, position))

    if (box.version === 1) {
      buffer = this._readBytes(fd, position, 8)
      box.timestamp = this._buffer2integer(buffer)
      position += 8

      buffer = this._readBytes(fd, position, 4)
      box.timescale = this._buffer2integer(buffer)
      position += 4

      buffer = this._readBytes(fd, position, 8)
      box.duration = this._buffer2integer(buffer)
      position += 4

    } else {
      buffer = this._readBytes(fd, position, 4)
      box.timestamp = this._buffer2integer(buffer)
      position += 4

      buffer = this._readBytes(fd, position, 4)
      position += 4

      buffer = this._readBytes(fd, position, 4)
      box.timescale = this._buffer2integer(buffer)
      position += 4

      buffer = this._readBytes(fd, position, 4)
      box.duration = this._buffer2integer(buffer)
      position += 4
    }

    return box
  }

  static parseBox_stsz(size, type, fd, position) {
    let box = { size: size, type: type }
    let buffer
    position += 8

    buffer = this._readBytes(fd, position, 1)
    box.version = buffer[0]
    position += 1

    buffer = this._readBytes(fd, position, 3)
    box.flag = this._buffer2integer(buffer)
    position += 3

    buffer = this._readBytes(fd, position, 4)
    box.sampleSize = this._buffer2integer(buffer)
    position += 4

    buffer = this._readBytes(fd, position, 4)
    box.sampleCount = this._buffer2integer(buffer)
    position += 4

    box.sampleTotal = 0
    if (box.smapleSize === 0) {
      for (let i = 0; i < box.sampleCount; i++) {
        buffer = this._readBytes(fd, position, 4)
        box.sampleTotal += this._buffer2integer(buffer)
        position += 4
      }
    } else {
      box.sampleTotal = box.sampleSize * box.sampleCount
    }

    return box
  }

  static _buffer2string(buffer) {
    return String.fromCharCode.apply(null, buffer)
  }

  static _buffer2integer(buffer) {
    let size = 0
    for (let i = 0; i < buffer.length; i++) {
      size += buffer[buffer.length - (1+i)] * (16 ** (i*2))
    }
    return size
  }

  static _buffer2uuid(buffer) {
    let uuid = ""

    for (let i = 0; i < buffer.length; i++) {
      let str = buffer[i].toString(16)
      uuid += (str.length === 1 ? "0" + str : str)
    }

    return [
      uuid.slice(0, 8),
      uuid.slice(8, 12),
      uuid.slice(12, 16),
      uuid.slice(16, 20),
      uuid.slice(20, 32)
    ].join('-')
  }

  static _readBytes(fd, position, size) {
    let fstat = fs.fstatSync(fd)
    if (!size) { size = fstat.size - position + 1 }
    let buffer = Buffer.alloc(size)
    fs.readSync(fd, buffer, 0, size, position)
    return buffer
  }

  static _readSizeAndType(fd, position) {
    let buffer, size, type

    buffer = this._readBytes(fd, position, 4)
    size = this._buffer2integer(buffer)

    buffer = this._readBytes(fd, position + 4, 4)
    type = this._buffer2string(buffer)

    if (size < 8) {
      if (size === 1) {
        buffer = this._readBytes(fd, position + 4 + 4, 8)
        size = this._buffer2integer(buffer)
      } else {
        throw new Error(`SizeError: { size: ${size}, type: ${type}}`)
      }
    }

    return { size: size, type: type }
  }
}
