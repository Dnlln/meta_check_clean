/**
 * Binary Metadata Cleaner & Selective Stripper for JPG and MP4
 */

// Wipes ALL metadata from JPG file (100% clean JPEG binary buffer)
export async function cleanAllJpgMetadata(file) {
  const arrayBuffer = await file.arrayBuffer();
  const dataView = new DataView(arrayBuffer);
  const bytes = new Uint8Array(arrayBuffer);

  // Verify JPEG magic bytes (0xFFD8)
  if (bytes[0] !== 0xFF || bytes[1] !== 0xD8) {
    throw new Error('Invalid JPEG file header');
  }

  const cleanChunks = [];
  cleanChunks.push(bytes.subarray(0, 2)); // SOI (Start of Image)

  let offset = 2;
  const length = bytes.length;

  while (offset < length - 1) {
    if (bytes[offset] !== 0xFF) {
      offset++;
      continue;
    }

    const marker = bytes[offset + 1];

    // End of Image (EOI) or SOS (Start of Scan - image data starts)
    if (marker === 0xD9 || marker === 0xDA) {
      cleanChunks.push(bytes.subarray(offset));
      break;
    }

    // Read segment length
    if (offset + 3 >= length) break;
    const segmentLength = dataView.getUint16(offset + 2, false);

    // APP0 to APP15 markers (0xE0 to 0xEF), COM marker (0xFE) contain metadata (EXIF, IPTC, XMP, comments)
    const isMetadataMarker = (marker >= 0xE1 && marker <= 0xEF) || marker === 0xFE;

    if (isMetadataMarker) {
      // Skip this metadata segment entirely!
      offset += 2 + segmentLength;
    } else {
      // Retain standard image headers (APP0 JFIF, DQT quantization tables, SOF0 frame header, DHT huffman tables)
      const chunkEnd = offset + 2 + segmentLength;
      cleanChunks.push(bytes.subarray(offset, chunkEnd));
      offset = chunkEnd;
    }
  }

  // Combine clean chunks into blob
  const totalCleanBytes = cleanChunks.reduce((acc, chunk) => acc + chunk.length, 0);
  const cleanArray = new Uint8Array(totalCleanBytes);
  let pos = 0;
  for (const chunk of cleanChunks) {
    cleanArray.set(chunk, pos);
    pos += chunk.length;
  }

  return new Blob([cleanArray], { type: 'image/jpeg' });
}

// Selective removal of metadata tags for JPG (removes ONLY target tags/GPS while keeping rest of EXIF intact)
export async function cleanSelectiveJpgMetadata(file, tagsToRemoveSet) {
  const shouldRemoveGps = Array.from(tagsToRemoveSet).some(id => 
    id.toLowerCase().includes('gps') || id.toLowerCase().includes('location') || id.toLowerCase().includes('coordinates')
  );
  
  if (tagsToRemoveSet.has('ALL')) {
    return cleanAllJpgMetadata(file);
  }

  const arrayBuffer = await file.arrayBuffer();
  const bytes = new Uint8Array(arrayBuffer.slice(0)); // clone buffer
  const dataView = new DataView(bytes.buffer);

  let offset = 2;
  const length = bytes.length;

  while (offset < length - 1) {
    if (bytes[offset] !== 0xFF) {
      offset++;
      continue;
    }

    const marker = bytes[offset + 1];
    if (marker === 0xD9 || marker === 0xDA) break;

    const segmentLength = dataView.getUint16(offset + 2, false);

    // APP1 Exif Segment (0xFFE1)
    if (marker === 0xE1) {
      const isExif = bytes[offset + 4] === 0x45 && bytes[offset + 5] === 0x78 && bytes[offset + 6] === 0x69 && bytes[offset + 7] === 0x66;
      if (isExif) {
        const exifHeaderOffset = offset + 10; // Start of TIFF header
        modifyTiffMetadata(dataView, bytes, exifHeaderOffset, shouldRemoveGps, tagsToRemoveSet);
      }

      // APP1 XMP Segment check - if GPS removal requested, wipe XMP GPS tags
      const isXmp = bytes[offset + 4] === 0x68 && bytes[offset + 5] === 0x74 && bytes[offset + 6] === 0x74 && bytes[offset + 7] === 0x70;
      if (isXmp && shouldRemoveGps) {
        // Blank out XMP GPS tags inside XML string
        for (let i = offset + 4; i < offset + 2 + segmentLength; i++) {
          if (bytes[i] === 0x47 && bytes[i+1] === 0x50 && bytes[i+2] === 0x53) { // 'GPS'
            bytes[i] = 0x58; bytes[i+1] = 0x58; bytes[i+2] = 0x58; // 'XXX'
          }
        }
      }
    }

    offset += 2 + segmentLength;
  }

  return new Blob([bytes], { type: 'image/jpeg' });
}

// Modify TIFF structure inside JPEG EXIF segment to zero out target tags (e.g. GPS 0x8825) without removing EXIF
function modifyTiffMetadata(dataView, bytes, tiffStart, shouldRemoveGps, tagsToRemoveSet) {
  try {
    if (tiffStart + 8 > bytes.length) return;

    // Determine endianness: 'II' (0x4949 Little-Endian) or 'MM' (0x4D4D Big-Endian)
    const isLittleEndian = bytes[tiffStart] === 0x49 && bytes[tiffStart + 1] === 0x49;
    const magic = dataView.getUint16(tiffStart + 2, isLittleEndian);
    if (magic !== 0x002A) return; // Not valid TIFF header

    const ifd0Offset = dataView.getUint32(tiffStart + 4, isLittleEndian);
    if (tiffStart + ifd0Offset >= bytes.length) return;

    // Scan IFD0
    scanAndScrubIfd(dataView, bytes, tiffStart, tiffStart + ifd0Offset, isLittleEndian, shouldRemoveGps, tagsToRemoveSet);

  } catch (err) {
    console.warn('Error modifying TIFF metadata:', err);
  }
}

function scanAndScrubIfd(dataView, bytes, tiffStart, ifdOffset, isLittleEndian, shouldRemoveGps, tagsToRemoveSet) {
  if (ifdOffset + 2 > bytes.length) return;

  const numEntries = dataView.getUint16(ifdOffset, isLittleEndian);
  let entryPtr = ifdOffset + 2;

  let exifSubIfdOffset = 0;
  let gpsIfdOffset = 0;

  for (let i = 0; i < numEntries; i++) {
    if (entryPtr + 12 > bytes.length) break;

    const tagId = dataView.getUint16(entryPtr, isLittleEndian);

    // Tag 0x8825 = GPSInfo IFD Pointer
    if (tagId === 0x8825) {
      gpsIfdOffset = dataView.getUint32(entryPtr + 8, isLittleEndian);
      if (shouldRemoveGps) {
        // Zero out tag entry 0x8825 so EXIF readers see NO GPS IFD pointer!
        for (let b = 0; b < 12; b++) {
          bytes[entryPtr + b] = 0x00;
        }
      }
    }

    // Tag 0x8769 = Exif SubIFD Pointer
    if (tagId === 0x8769) {
      exifSubIfdOffset = dataView.getUint32(entryPtr + 8, isLittleEndian);
    }

    // Check selective tags to remove by tag ID or key matching
    if (tagsToRemoveSet && tagsToRemoveSet.size > 0) {
      for (const removedId of tagsToRemoveSet) {
        if (shouldRemoveTag(tagId, removedId)) {
          // Zero out this specific tag entry!
          for (let b = 0; b < 12; b++) {
            bytes[entryPtr + b] = 0x00;
          }
        }
      }
    }

    entryPtr += 12;
  }

  // Also scrub Exif SubIFD if present
  if (exifSubIfdOffset > 0 && tiffStart + exifSubIfdOffset < bytes.length) {
    scanAndScrubIfd(dataView, bytes, tiffStart, tiffStart + exifSubIfdOffset, isLittleEndian, false, tagsToRemoveSet);
  }

  // Also scrub GPS IFD data area if present
  if (gpsIfdOffset > 0 && tiffStart + gpsIfdOffset < bytes.length && shouldRemoveGps) {
    const gpsIfdStart = tiffStart + gpsIfdOffset;
    if (gpsIfdStart + 2 <= bytes.length) {
      const gpsEntries = dataView.getUint16(gpsIfdStart, isLittleEndian);
      let gPtr = gpsIfdStart + 2;
      for (let g = 0; g < gpsEntries; g++) {
        if (gPtr + 12 > bytes.length) break;
        // Zero out GPS entries
        for (let b = 0; b < 12; b++) {
          bytes[gPtr + b] = 0x00;
        }
        gPtr += 12;
      }
    }
  }
}

// Map tag ID numbers to common EXIF names for selective removal
function shouldRemoveTag(tagNumber, removedIdString) {
  const tagHex = '0x' + tagNumber.toString(16).padStart(4, '0').toLowerCase();
  const idLower = removedIdString.toLowerCase();

  if (idLower.includes(tagHex)) return true;

  // Common tag mappings
  const map = {
    '0x010f': ['make', 'камера'],
    '0x0110': ['model', 'модель'],
    '0x0131': ['software', 'программа'],
    '0x0132': ['datetime', 'дата'],
    '0x9003': ['datetimeoriginal', 'оригинал'],
    '0x829a': ['exposuretime', 'выдержка'],
    '0x829d': ['fnumber', 'диафрагма'],
    '0x8827': ['isospeedratings', 'iso'],
    '0xa405': ['focallengthin35mmfilm', 'фокус']
  };

  const matches = map[tagHex];
  if (matches) {
    return matches.some(m => idLower.includes(m));
  }

  return false;
}


// Wipes ALL metadata & user-data atoms from MP4 video file
export async function cleanAllMp4Metadata(file) {
  const arrayBuffer = await file.arrayBuffer();
  const view = new DataView(arrayBuffer);
  const bytes = new Uint8Array(arrayBuffer);

  // Rebuild MP4 atom tree skipping udta, meta, and metadata tags
  const cleanBuffer = stripMp4Atoms(bytes, view, 0, bytes.length, ['udta', 'meta', 'ilst', '©xyz', 'location']);
  return new Blob([cleanBuffer], { type: 'video/mp4' });
}

// Selective removal of metadata tags for MP4
export async function cleanSelectiveMp4Metadata(file, tagsToRemoveSet) {
  const removeGps = Array.from(tagsToRemoveSet).some(id => id.toLowerCase().includes('gps') || id.toLowerCase().includes('location') || id.toLowerCase().includes('xyz'));

  const arrayBuffer = await file.arrayBuffer();
  const view = new DataView(arrayBuffer);
  const bytes = new Uint8Array(arrayBuffer);

  const targetAtomsToRemove = [];
  if (removeGps) {
    targetAtomsToRemove.push('©xyz', 'location', 'loci');
  }

  if (tagsToRemoveSet.has('ALL')) {
    targetAtomsToRemove.push('udta', 'meta', 'ilst');
  }

  const cleanBuffer = stripMp4Atoms(bytes, view, 0, bytes.length, targetAtomsToRemove);
  return new Blob([cleanBuffer], { type: 'video/mp4' });
}

// Helper to filter out specified MP4 atoms without re-encoding video stream
function stripMp4Atoms(bytes, view, start, end, atomsToStrip) {
  const outputChunks = [];
  let offset = start;

  while (offset + 8 <= end) {
    const size = view.getUint32(offset);
    if (size < 8 || offset + size > end) {
      // Append remaining bytes
      outputChunks.push(bytes.subarray(offset, end));
      break;
    }

    const type = String.fromCharCode(
      bytes[offset + 4],
      bytes[offset + 5],
      bytes[offset + 6],
      bytes[offset + 7]
    );

    if (atomsToStrip.includes(type)) {
      // Skip this atom entirely!
      offset += size;
      continue;
    }

    if (type === 'moov' || type === 'udta') {
      // Container box: parse children recursively
      const header = bytes.subarray(offset, offset + 8);
      const innerClean = stripMp4Atoms(bytes, view, offset + 8, offset + size, atomsToStrip);
      
      // Update container box size header
      const newBoxSize = 8 + innerClean.length;
      const newHeader = new Uint8Array(8);
      const headerView = new DataView(newHeader.buffer);
      headerView.setUint32(0, newBoxSize);
      newHeader.set(header.subarray(4, 8), 4);

      outputChunks.push(newHeader);
      outputChunks.push(innerClean);
      offset += size;
      continue;
    }

    outputChunks.push(bytes.subarray(offset, offset + size));
    offset += size;
  }

  const totalLength = outputChunks.reduce((acc, chunk) => acc + chunk.length, 0);
  const result = new Uint8Array(totalLength);
  let pos = 0;
  for (const chunk of outputChunks) {
    result.set(chunk, pos);
    pos += chunk.length;
  }

  return result;
}

// Helper to download cleaned blob file in browser
export function triggerFileDownload(blob, originalFilename, isCleanedAll = true) {
  const extensionIndex = originalFilename.lastIndexOf('.');
  const name = extensionIndex !== -1 ? originalFilename.substring(0, extensionIndex) : originalFilename;
  const ext = extensionIndex !== -1 ? originalFilename.substring(extensionIndex) : '';
  const suffix = isCleanedAll ? '_clean' : '_edited';
  
  const newFilename = `${name}${suffix}${ext}`;

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = newFilename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
