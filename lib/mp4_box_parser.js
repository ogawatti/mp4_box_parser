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
    return [ 'moov', 'edts', 'mdia', 'minf', 'dinf', 'udta', 'ilst' ]
  }

  static get existsBothBoxes() {
    return [ 'trak' ]
  }

  static get maxSize() { return 0xFFFFFFFF }

  static parseBox(fd, position, boxSize) {
    let box = {}
    let parsedBox

    while (position + 8 < boxSize) {
      let { size, type } = this._readSizeAndType(fd, position)
      let stlength = size < this.maxSize ? 8 : 16
          
      if (this.hasChildBoxes.includes(type)) {
        // ChildBox を見に行く場合
        parsedBox = this.parseBox(fd, position + stlength, position + size)
        box[type] = Object.assign({ size: size, type: type }, parsedBox)
        position += size
      } else if (this.existsBothBoxes.includes(type)) {
        // 同一階層に複数同じTypeがあり、配列で返す場合
        parsedBox = this.parseBox(fd, position + stlength, position + size)
        parsedBox = Object.assign({ size: size, type: type }, parsedBox)
        if (!box[type]) { box[type] = [] }
        box[type].push(parsedBox)
        position += size
      } else if (type === 'stbl') {
        // ChildBox同士が関連するため親階層で処理が必要
        parsedBox = this.parseBox(fd, position + stlength, position + size)
        let sdtp = parsedBox.sdtp
        if (sdtp) {
          let stz = parsedBox.stsz || parsedBox.stz2
          parsedBox.sdtp = this.parseBox_sdtp_with_sampleCount(sdtp.size, sdtp.type, fd, sdtp.position, stz.sampleCount)
        }
        box[type] = Object.assign({ size: size, type: type }, parsedBox)
        position += size
      } else if (type === 'meta') {
        // TODO : ChildBoxありの場合と統合したい
        //ChildBoxを見に行くが、FullBoxの場合
        parsedBox = this.parseBox(fd, position + stlength + 4, position + size)
        box[type] = Object.assign(this.parseBox_xxxx(size, type, fd, position), parsedBox)
        position += size
      } else if (type === 'uuid') {
        // 同一階層に複数同じTypeがあり、特定のキーで分ける場合
        let uuidBox = this.parseBox_xxxx(size, type, fd, position)
        let uuid = Object.keys(uuidBox)[0]
        parsedBox = this.parseBox(fd, position + stlength + 16, position + size)
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

  static parseBoxFunctionName(type) {
    let replaced = type.replace(/@/, "aa")
    replaced = type.replace(/©/, "cc")
    return `parseBox_${replaced}`
  }

  static parseBox_xxxx(size, type, fd, position) {
    let functionName = this.parseBoxFunctionName(type)

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
    box.duration = Math.round(box.duration * 100 / box.timescale) / 100

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
    //box.reserved = this._buffer2integer(buffer)
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
    //box.reserved = this._buffer2integer(buffer)
    position += 2

    buffer = this._readBytes(fd, position, 4 * 9)
    //box.matrix = this._buffer2integer(buffer)
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
    box.handlerType = this._buffer2string(buffer)
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

    /*
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
    */

    return box
  }

  static parseBox_free(size, type, fd, position) {
    let box = { size: size, type: type }
    position += 8

    if (box.size > 8) {
      let buffer = this._readBytes(fd, position, 1)
      box.data = this._buffer2integer(buffer)
      position += 1
    }

    return box
  }

  static parseBox_skip(size, type, fd, position) {
    return parseBox_free(size, type, fd, position)
  }

  static parseBox_vmhd(size, type, fd, position) {
    let box, buffer
    ({ box, position } = this.parseFullBox(size, type, fd, position))

    buffer = this._readBytes(fd, position, 2)
    box.graphicsmode = this._buffer2integer(buffer)
    position += 2

    buffer = this._readBytes(fd, position, 2 * 3)
    box.opcolor = [
      this._buffer2integer(buffer.slice(0, 2)),
      this._buffer2integer(buffer.slice(2, 4)),
      this._buffer2integer(buffer.slice(4, 6)),
    ]
    position += 2 * 3

    return box
  }

  static parseBox_smhd(size, type, fd, position) {
    let box, buffer
    ({ box, position } = this.parseFullBox(size, type, fd, position))

    buffer = this._readBytes(fd, position, 2)
    box.balance = this._buffer2integer(buffer)
    position += 2

    buffer = this._readBytes(fd, position, 2)
    //box.reserved = this._buffer2integer(buffer)
    position += 2

    return box
  }

  static parseBox_dref(size, type, fd, position) {
    let box, buffer
    ({ box, position } = this.parseFullBox(size, type, fd, position))

    buffer = this._readBytes(fd, position, 4)
    box.entryCount = this._buffer2integer(buffer)
    position += 4

    /*
    box.entry = []
    let entryBoxSize
    let entryBoxType
    for (let i = 1; i <= box.entryCount; i++) {
      // TODO : parseFullBox 差し替え
      let entryBox = this._readSizeAndType(fd, position)
      position += 8

      buffer = this._readBytes(fd, position, 1)
      entryBox.version = buffer[0]
      position += 1

      buffer = this._readBytes(fd, position, 3)
      entryBox.flag = this._buffer2integer(buffer)
      position += 3

      box.entry.push(entryBox)
    }
    */

    return box
  }

  static parseBox_stsd(size, type, fd, position) {
    let box, buffer
    ({ box, position } = this.parseFullBox(size, type, fd, position))

    buffer = this._readBytes(fd, position, 4)
    box.entryCount = this._buffer2integer(buffer)
    position += 4

    for (let i = 1; i <= box.entryCount; i++) {
      let entryBox = this._readSizeAndType(fd, position)
      box[entryBox.type] = entryBox
      position += entryBox.size
    }

    return box
  }

  // TODO : avc1
  static parseBox_avc1(size, type, fd, position) {
    return this._readSizeAndType(fd, position)
  }

  static parseBox_stts(size, type, fd, position) {
    let box, buffer
    ({ box, position } = this.parseFullBox(size, type, fd, position))

    buffer = this._readBytes(fd, position, 4)
    box.entryCount = this._buffer2integer(buffer)
    position += 4

    /*
    box.entry = []
    for (let i = 0; i < box.entryCount; i++) {
      let entryBox = {}

      buffer = this._readBytes(fd, position, 4)
      entryBox.sampleCount = this._buffer2integer(buffer)
      position += 4

      buffer = this._readBytes(fd, position, 4)
      entryBox.sampleDelta = this._buffer2integer(buffer)
      position += 4

      box.entry.push(entryBox)
    }
    */

    return box
  }

  static parseBox_ctts(size, type, fd, position) {
    let box, buffer
    ({ box, position } = this.parseFullBox(size, type, fd, position))

    buffer = this._readBytes(fd, position, 4)
    box.entryCount = this._buffer2integer(buffer)
    position += 4

    /* TODO : uncomment
    box.entry = []
    if (box.version === 0) {
      for (let i = 0; i < box.entryCount; i++) {
        let entryBox = {}

        buffer = this._readBytes(fd, position, 4)
        entryBox.sampleCount = this._buffer2integer(buffer)
        position += 4

        buffer = this._readBytes(fd, position, 4)
        entryBox.sampleOffset = this._buffer2integer(buffer)
        position += 4

        box.entry.push(entryBox)
      }
    } else {
      for (let i = 0; i < box.entryCount; i++) {
        let entryBox = {}

        buffer = this._readBytes(fd, position, 4)
        entryBox.sampleCount = this._buffer2integer(buffer)
        position += 4

        buffer = this._readBytes(fd, position, 4)
        entryBox.sampleOffset = this._buffer2integer(buffer)  //signed
        position += 4

        box.entry.push(entryBox)
      }
    }
    */

    return box
  }

  static parseBox_stsc(size, type, fd, position) {
    let box, buffer
    ({ box, position } = this.parseFullBox(size, type, fd, position))

    buffer = this._readBytes(fd, position, 4)
    box.entryCount = this._buffer2integer(buffer)
    position += 4

    /*
    box.entry = []
    for (let i = 1; i <= box.entryCount; i++) {
      let entryBox = {}

      buffer = this._readBytes(fd, position, 4)
      entryBox.firstChunk = this._buffer2integer(buffer)
      position += 4

      buffer = this._readBytes(fd, position, 4)
      entryBox.samplesPerChank = this._buffer2integer(buffer)
      position += 4

      buffer = this._readBytes(fd, position, 4)
      entryBox.sampleDescriptionIndex = this._buffer2integer(buffer)
      position += 4

      box.entry.push(entryBox)
    }
    */

    return box
  }

  static parseBox_stsz(size, type, fd, position) {
    let box, buffer
    ({ box, position } = this.parseFullBox(size, type, fd, position))

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

  static parseBox_stz2(size, type, fd, position) {
    let box, buffer
    ({ box, position } = this.parseFullBox(size, type, fd, position))

    buffer = this._readBytes(fd, position, 3)
    box.reserved = this._buffer2integer(buffer)
    position += 3

    buffer = this._readBytes(fd, position, 1)
    box.fieldSize = this._buffer2integer(buffer)
    position += 1

    buffer = this._readBytes(fd, position, 4)
    box.sampleCount = this._buffer2integer(buffer)
    position += 4

    /*
    box.entrySize = []
    for (let i = 1; i <= box.sampleCount; i++) {
      buffer = this._readBytes(fd, position, box.fieldSize)
      box.entrySize.push(this._buffer2integer(buffer))
      position += box.fieldSize
    }
    */

    return box
  }

  // TODO : entry or entryBox 統一

  static parseBox_chunkOffset(size, type, fd, position) {
    let box, buffer
    ({ box, position } = this.parseFullBox(size, type, fd, position))

    buffer = this._readBytes(fd, position, 4)
    box.entryCount = this._buffer2integer(buffer)
    position += 4

    let chunkOffsetSize = type === 'stco' ? 4 : 8

    /*
    box.entry = []
    for (let i = 1; i <= box.entryCount; i++) {
      let entryBox = {}

      buffer = this._readBytes(fd, position, chunkOffsetSize)
      entryBox.chunkOffset = this._buffer2integer(buffer)
      position += chunkOffsetSize

      box.entry.push(entryBox)
    }
    */

    return box
  }

  static parseBox_stco(size, type, fd, position) {
    return this.parseBox_chunkOffset(size, type, fd, position)
  }

  static parseBox_co64(size, type, fd, position) {
    return this.parseBox_chunkOffset(size, type, fd, position)
  }

  static parseBox_stss(size, type, fd, position) {
    let box, buffer
    ({ box, position } = this.parseFullBox(size, type, fd, position))

    buffer = this._readBytes(fd, position, 4)
    box.entryCount = this._buffer2integer(buffer)
    position += 4

    /*
    box.entry = []
    for (let i = 0; i < box.entryCount; i++) {
      let entryBox = {}

      buffer = this._readBytes(fd, position, 4)
      entryBox.sampleNumber = this._buffer2integer(buffer)
      position += 4

      box.entry.push(entryBox)
    }
    */

    return box
  }

  static parseBox_sdtp(size, type, fd, position) {
    let box
    ({ box, position } = this.parseFullBox(size, type, fd, position))
    box.position = position

    return box
  }

  static parseBox_sdtp_with_sampleCount(size, type, fd, position, sampleCount) {
    let box, buffer
    ({ box, position } = this.parseFullBox(size, type, fd, position))

    /*
    // TODO : sampleの値の変換 (0~4 => xxxx)
    box.sample = []
    for (let i = 0; i < sampleCount; i++) {
      let sampleBox = {}

      buffer = this._readBytes(fd, position, 1)
      let onebyte = ('00000000' + buffer[0].toString(2)).slice(-8)
      sampleBox.isLeading = parseInt(onebyte.slice(0, 2), 2)
      sampleBox.sampleDependsOn = parseInt(onebyte.slice(2, 4), 2)
      sampleBox.sampleIsDependentOn = parseInt(onebyte.slice(4, 6), 2)
      sampleBox.sampleHasReduntancy = parseInt(onebyte.slice(6, 8), 2)
      position += 1

      box.sample.push(sampleBox)
    }
    */

    return box
  }

  static parseBox_meta(size, type, fd, position) {
    let box
    ({ box, position } = this.parseFullBox(size, type, fd, position))

    return box
  }

  static parseBox_cprt(size, type, fd, position) {
    let box
    ({ box, position } = this.parseFullBox(size, type, fd, position))

    return box
  }

  static parseBox_ccxxx(size, type, fd, position) {
    let endPosition = position + size
    let box = { size: size, type: type }
    let buffer
    position += 8

    buffer = this._readBytes(fd, position, 4)
    // size = this._buffer2integer(buffer)
    position += 4

    buffer = this._readBytes(fd, position, 4)
    //box.name = this._buffer2string(buffer)  //=== 'data'
    position += 4

    buffer = this._readBytes(fd, position, 4)
    //box.typeIndicator = this._buffer2integer(buffer)
    position += 4

    buffer = this._readBytes(fd, position, 4)
    //box.localeIndicator = this._buffer2integer(buffer)
    position += 4

    buffer = this._readBytes(fd, position, endPosition - position)
    box.data = this._buffer2stringMultiBytes(buffer)

    return box
  }
  static parseBox_ccnam(size, type, fd, position) {
    return this.parseBox_ccxxx(size, type, fd, position)
  }
  static parseBox_cctoo(size, type, fd, position) {
    return this.parseBox_ccxxx(size, type, fd, position)
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

  static _buffer2string(buffer) {
    return String.fromCharCode.apply(null, buffer)
  }

  static _buffer2stringMultiBytes(buffer) {
    let unescaped = String.fromCharCode.apply(null, buffer)
    return decodeURIComponent(escape(unescaped))
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
