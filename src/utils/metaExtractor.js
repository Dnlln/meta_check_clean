import ExifReader from 'exifreader';
import { formatCoordinates } from './geoUtils';

/**
 * Extracts complete metadata from JPG photo or MP4 video file
 */
export async function extractMetadata(file) {
  const isJpg = file.type === 'image/jpeg' || file.name.toLowerCase().endsWith('.jpg') || file.name.toLowerCase().endsWith('.jpeg');
  const isMp4 = file.type === 'video/mp4' || file.name.toLowerCase().endsWith('.mp4');

  const fileInfo = {
    fileName: file.name,
    fileSize: formatBytes(file.size),
    rawSizeBytes: file.size,
    fileType: isJpg ? 'JPG Image' : isMp4 ? 'MP4 Video' : file.type || 'Unknown',
    lastModified: new Date(file.lastModified).toLocaleString('ru-RU')
  };

  let mediaDimensions = { width: null, height: null, duration: null };
  let gpsData = null;
  let parsedTags = [];
  let categorized = {
    overview: [],
    camera: [],
    location: [],
    technical: [],
    raw: []
  };

  try {
    if (isJpg) {
      // Parse JPG Image EXIF & Image dimensions
      const arrayBuffer = await file.arrayBuffer();
      const tags = ExifReader.load(arrayBuffer, { expanded: true });

      // Get image dimensions from HTML Image
      mediaDimensions = await getJpgDimensions(file);

      // Extract GPS
      if (tags.gps && tags.gps.Latitude != null && tags.gps.Longitude != null) {
        gpsData = formatCoordinates(tags.gps.Latitude, tags.gps.Longitude);
        if (tags.gps.Altitude != null) {
          gpsData.altitude = `${tags.gps.Altitude.toFixed(1)} m`;
        }
      }

      // Process EXIF tags into structured categories
      parsedTags = formatExifTags(tags);
    } else if (isMp4) {
      // Parse MP4 Video metadata
      const arrayBuffer = await file.arrayBuffer();
      mediaDimensions = await getMp4Dimensions(file);

      // Extract MP4 Quicktime metadata & ExifReader MP4 tags
      let mp4Exif = {};
      try {
        mp4Exif = ExifReader.load(arrayBuffer, { expanded: true });
      } catch (err) {
        console.warn('ExifReader MP4 parse note:', err);
      }

      const quicktimeTags = parseMp4Atoms(arrayBuffer);

      // Check GPS in MP4
      if (quicktimeTags.gps) {
        gpsData = formatCoordinates(quicktimeTags.gps.lat, quicktimeTags.gps.lng);
      } else if (mp4Exif.gps && mp4Exif.gps.Latitude != null) {
        gpsData = formatCoordinates(mp4Exif.gps.Latitude, mp4Exif.gps.Longitude);
      }

      parsedTags = formatMp4Tags(quicktimeTags, mp4Exif, mediaDimensions, fileInfo);
    }

    // Organize into categorized groups
    categorized = groupTagsIntoCategories(parsedTags, gpsData, mediaDimensions, fileInfo, isJpg ? 'photo' : 'video');

  } catch (error) {
    console.error('Error extracting metadata:', error);
    parsedTags.push({
      key: 'Parse Note',
      value: `Warning reading full tags: ${error.message}`,
      category: 'overview'
    });
  }

  return {
    fileInfo,
    mediaDimensions,
    gpsData,
    parsedTags,
    categorized,
    isJpg,
    isMp4
  };
}

// Helper to get image dimensions
function getJpgDimensions(file) {
  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      resolve({ width: img.naturalWidth, height: img.naturalHeight, duration: null });
      URL.revokeObjectURL(url);
    };
    img.onerror = () => resolve({ width: null, height: null, duration: null });
    img.src = url;
  });
}

// Helper to get video dimensions & duration
function getMp4Dimensions(file) {
  return new Promise((resolve) => {
    const video = document.createElement('video');
    video.preload = 'metadata';
    const url = URL.createObjectURL(file);
    video.onloadedmetadata = () => {
      resolve({
        width: video.videoWidth,
        height: video.videoHeight,
        duration: formatDuration(video.duration),
        rawDurationSec: video.duration
      });
      URL.revokeObjectURL(url);
    };
    video.onerror = () => resolve({ width: null, height: null, duration: null });
    video.src = url;
  });
}

// Convert ExifReader loaded tags into list
function formatExifTags(tags) {
  const result = [];
  
  // Helper to add tag
  const addTag = (groupName, rawGroup) => {
    if (!rawGroup) return;
    for (const [key, item] of Object.entries(rawGroup)) {
      if (key === 'Thumbnail' || key === 'base64') continue;
      const valStr = item.description || item.value || String(item);
      result.push({
        id: `${groupName}_${key}`,
        key: `${groupName}: ${key}`,
        rawKey: key,
        group: groupName,
        value: String(valStr)
      });
    }
  };

  if (tags.exif) addTag('EXIF', tags.exif);
  if (tags.image) addTag('Image', tags.image);
  if (tags.gps) addTag('GPS', tags.gps);
  if (tags.iptc) addTag('IPTC', tags.iptc);
  if (tags.xmp) addTag('XMP', tags.xmp);

  return result;
}

// Custom binary MP4 QuickTime Atom parser for GPS coordinates and metadata
function parseMp4Atoms(arrayBuffer) {
  const view = new DataView(arrayBuffer);
  const result = { tags: [], gps: null };

  try {
    let offset = 0;
    const totalLen = view.byteLength;

    // Search for moov atom
    while (offset + 8 < totalLen) {
      const size = view.getUint32(offset);
      const type = String.fromCharCode(
        view.getUint8(offset + 4),
        view.getUint8(offset + 5),
        view.getUint8(offset + 6),
        view.getUint8(offset + 7)
      );

      if (size === 1) break; // 64-bit size, skip deep parse
      if (size < 8) break;

      if (type === 'moov' || type === 'udta' || type === 'meta' || type === 'ilst') {
        // Recursive atom search inside metadata boxes
        searchAtoms(view, offset + 8, Math.min(offset + size, totalLen), result);
      }
      offset += size;
    }
  } catch (err) {
    console.warn('MP4 atom scan ended:', err);
  }

  return result;
}

function searchAtoms(view, start, end, result) {
  let offset = start;
  while (offset + 8 < end) {
    const size = view.getUint32(offset);
    if (size < 8 || offset + size > end) {
      offset += 4;
      continue;
    }

    const type = String.fromCharCode(
      view.getUint8(offset + 4),
      view.getUint8(offset + 5),
      view.getUint8(offset + 6),
      view.getUint8(offset + 7)
    );

    // Look for ISO 6709 GPS Location string tag ©xyz or location
    if (type === '©xyz' || type === 'location' || type === 'loci') {
      try {
        let str = '';
        for (let i = 8; i < size; i++) {
          const charCode = view.getUint8(offset + i);
          if (charCode >= 32 && charCode <= 126 || charCode === 43 || charCode === 45) {
            str += String.fromCharCode(charCode);
          }
        }
        // Format of ISO 6709: +37.7510-122.4200/ or +55.7558+037.6173/
        const match = str.match(/([+-]\d+\.\d+)([+-]\d+\.\d+)/);
        if (match) {
          const lat = parseFloat(match[1]);
          const lng = parseFloat(match[2]);
          if (!isNaN(lat) && !isNaN(lng)) {
            result.gps = { lat, lng, rawString: str };
            result.tags.push({ key: 'MP4: GPS Location (ISO 6709)', value: `${lat}, ${lng} (${str})` });
          }
        }
      } catch (e) {
        console.warn('Failed parsing MP4 GPS tag', e);
      }
    }

    // Common metadata tags
    if (['©nam', '©art', '©alb', '©day', '©too', '©cmt', '©xyz'].includes(type)) {
      let str = '';
      for (let i = 12; i < size; i++) {
        const c = view.getUint8(offset + i);
        if (c >= 32 && c <= 126) str += String.fromCharCode(c);
      }
      if (str.trim()) {
        result.tags.push({ key: `MP4: Atom ${type}`, value: str.trim() });
      }
    }

    if (['moov', 'udta', 'meta', 'ilst', 'trak', 'mdia'].includes(type)) {
      searchAtoms(view, offset + 8, offset + size, result);
    }

    offset += size;
  }
}

function formatMp4Tags(quicktimeTags, mp4Exif, dimensions, fileInfo) {
  const result = [];

  if (quicktimeTags.tags) {
    quicktimeTags.tags.forEach((item, index) => {
      result.push({
        id: `mp4_qt_${index}`,
        key: item.key,
        group: 'QuickTime',
        value: item.value
      });
    });
  }

  if (mp4Exif) {
    const exifTags = formatExifTags(mp4Exif);
    result.push(...exifTags);
  }

  // Technical video items
  result.push({ id: 'vid_res', key: 'Video: Resolution', group: 'Technical', value: `${dimensions.width || 0} x ${dimensions.height || 0} px` });
  result.push({ id: 'vid_dur', key: 'Video: Duration', group: 'Technical', value: dimensions.duration || 'Unknown' });
  result.push({ id: 'vid_file', key: 'File: Size', group: 'Technical', value: fileInfo.fileSize });

  return result;
}

function groupTagsIntoCategories(tags, gpsData, mediaDimensions, fileInfo, type) {
  const overview = [
    { key: 'Имя файла', value: fileInfo.fileName },
    { key: 'Размер файла', value: fileInfo.fileSize },
    { key: 'Тип файла', value: fileInfo.fileType },
    { key: 'Разрешение', value: mediaDimensions.width ? `${mediaDimensions.width} × ${mediaDimensions.height} px` : '—' },
  ];

  if (type === 'video' && mediaDimensions.duration) {
    overview.push({ key: 'Длительность', value: mediaDimensions.duration });
  }

  if (gpsData) {
    overview.push({ key: 'GPS Координаты', value: gpsData.formatted });
  } else {
    overview.push({ key: 'GPS Координаты', value: 'Отсутствуют' });
  }

  const camera = [];
  const location = [];
  const technical = [];
  const raw = [...tags];

  tags.forEach(tag => {
    const keyLower = tag.key.toLowerCase();
    const groupLower = (tag.group || '').toLowerCase();

    if (keyLower.includes('make') || keyLower.includes('model') || keyLower.includes('software') || keyLower.includes('lens') || keyLower.includes('iso') || keyLower.includes('fnumber') || keyLower.includes('exposure')) {
      camera.push(tag);
    } else if (groupLower.includes('gps') || keyLower.includes('gps') || keyLower.includes('location')) {
      location.push(tag);
    } else {
      technical.push(tag);
    }
  });

  return {
    overview,
    camera,
    location,
    technical,
    raw
  };
}

function formatBytes(bytes, decimals = 2) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

function formatDuration(seconds) {
  if (!seconds || isNaN(seconds)) return '00:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  const hrs = Math.floor(mins / 60);
  const remMins = mins % 60;
  
  if (hrs > 0) {
    return `${String(hrs).padStart(2, '0')}:${String(remMins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}
