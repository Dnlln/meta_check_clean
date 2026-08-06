import React from 'react';
import { FileImage, FileVideo, MapPin, Plus, Trash2 } from 'lucide-react';

export default function Sidebar({ files, activeIndex, onSelectFile, onAddFiles, onClearAll }) {
  const handleFileChange = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      onAddFiles(Array.from(e.target.files));
    }
  };

  return (
    <div className="sidebar">
      <div className="sidebar-header">
        <div className="sidebar-title">
          <span>Файлы ({files.length})</span>
        </div>
        <div style={{ display: 'flex', gap: '4px' }}>
          <label className="win-icon-btn" title="Добавить файлы">
            <Plus size={16} />
            <input
              type="file"
              multiple
              accept=".jpg,.jpeg,.mp4"
              onChange={handleFileChange}
              style={{ display: 'none' }}
            />
          </label>
          {files.length > 0 && (
            <button className="win-icon-btn danger" title="Очистить список" onClick={onClearAll}>
              <Trash2 size={15} />
            </button>
          )}
        </div>
      </div>

      <div className="sidebar-file-list">
        {files.map((item, index) => {
          const isActive = index === activeIndex;
          const isJpg = item.meta.isJpg;
          const hasGps = Boolean(item.meta.gpsData);

          return (
            <div
              key={index}
              className={`file-item ${isActive ? 'active' : ''}`}
              onClick={() => onSelectFile(index)}
            >
              <div className="file-icon-box">
                {isJpg ? <FileImage size={20} /> : <FileVideo size={20} />}
              </div>
              <div className="file-info">
                <div className="file-name" title={item.file.name}>
                  {item.file.name}
                </div>
                <div className="file-meta-sub">
                  <span>{item.meta.fileInfo.fileSize}</span>
                  {hasGps ? (
                    <span className="gps-badge">
                      <MapPin size={9} /> GPS
                    </span>
                  ) : (
                    <span className="no-gps-badge">Без GPS</span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
