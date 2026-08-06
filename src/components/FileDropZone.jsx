import React, { useState } from 'react';
import { UploadCloud, FileImage, FileVideo, Plus } from 'lucide-react';

export default function FileDropZone({ onFilesAdded }) {
  const [isDragActive, setIsDragActive] = useState(false);

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragActive(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragActive(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      filterAndAddFiles(Array.from(e.dataTransfer.files));
    }
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      filterAndAddFiles(Array.from(e.target.files));
    }
  };

  const filterAndAddFiles = (files) => {
    const valid = files.filter(f => {
      const ext = f.name.toLowerCase();
      return ext.endsWith('.jpg') || ext.endsWith('.jpeg') || ext.endsWith('.mp4') || f.type.startsWith('image/jpeg') || f.type.startsWith('video/mp4');
    });
    if (valid.length > 0) {
      onFilesAdded(valid);
    } else {
      alert('Пожалуйста, выберите файлы фотографий JPG (.jpg) или видео MP4 (.mp4)');
    }
  };

  return (
    <div
      className={`empty-dropzone ${isDragActive ? 'drag-active' : ''}`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <UploadCloud className="dropzone-icon" />
      <h2 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '8px' }}>
        Перетащите JPG фотографии или MP4 видео сюда
      </h2>
      <p style={{ color: 'var(--win-text-secondary)', fontSize: '13px', marginBottom: '20px' }}>
        Поддерживаются метаданные EXIF, IPTC, XMP, QuickTime и GPS координаты
      </p>

      <label className="win-btn primary" style={{ cursor: 'pointer', padding: '8px 20px', fontSize: '13px' }}>
        <Plus size={16} />
        <span>Выбрать файлы на компьютере</span>
        <input
          type="file"
          multiple
          accept=".jpg,.jpeg,.mp4"
          onChange={handleFileChange}
          style={{ display: 'none' }}
        />
      </label>

      <div style={{ display: 'flex', gap: '16px', marginTop: '24px', opacity: 0.6, fontSize: '12px' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <FileImage size={14} /> JPG / JPEG
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <FileVideo size={14} /> MP4 Video
        </span>
      </div>
    </div>
  );
}
