import React, { useState, useEffect } from 'react';
import { Eye, RotateCw, ZoomIn, ZoomOut, Maximize2 } from 'lucide-react';

export default function MediaPreview({ file, meta }) {
  const [objectUrl, setObjectUrl] = useState(null);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [rotation, setRotation] = useState(0);

  useEffect(() => {
    if (file) {
      const url = URL.createObjectURL(file);
      setObjectUrl(url);
      setZoomLevel(1);
      setRotation(0);
      return () => URL.revokeObjectURL(url);
    }
  }, [file]);

  if (!file || !objectUrl) return null;

  const handleZoomIn = () => setZoomLevel(prev => Math.min(prev + 0.25, 3));
  const handleZoomOut = () => setZoomLevel(prev => Math.max(prev - 0.25, 0.5));
  const handleRotate = () => setRotation(prev => (prev + 90) % 360);

  return (
    <div className="pane-card media-preview-pane">
      <div className="pane-header">
        <div className="pane-title">
          <Eye size={16} />
          <span>Предпросмотр ({meta.isJpg ? 'Фото JPG' : 'Видео MP4'})</span>
        </div>
        {meta.isJpg && (
          <div style={{ display: 'flex', gap: '4px' }}>
            <button className="win-icon-btn" title="Отдалить" onClick={handleZoomOut}>
              <ZoomOut size={14} />
            </button>
            <span style={{ fontSize: '11px', color: 'var(--win-text-muted)', display: 'inline-flex', alignItems: 'center', padding: '0 4px' }}>
              {Math.round(zoomLevel * 100)}%
            </span>
            <button className="win-icon-btn" title="Приблизить" onClick={handleZoomIn}>
              <ZoomIn size={14} />
            </button>
            <button className="win-icon-btn" title="Повернуть" onClick={handleRotate}>
              <RotateCw size={14} />
            </button>
          </div>
        )}
      </div>

      <div className="pane-content media-container">
        {meta.isJpg ? (
          <img
            src={objectUrl}
            alt={file.name}
            className="image-preview"
            style={{
              transform: `scale(${zoomLevel}) rotate(${rotation}deg)`
            }}
          />
        ) : (
          <video
            src={objectUrl}
            controls
            className="video-preview"
          />
        )}
      </div>
    </div>
  );
}
