import React, { useState } from 'react';
import TitleBar from './components/TitleBar';
import Sidebar from './components/Sidebar';
import FileDropZone from './components/FileDropZone';
import MediaPreview from './components/MediaPreview';
import MapView from './components/MapView';
import MetadataPanel from './components/MetadataPanel';
import { extractMetadata } from './utils/metaExtractor';
import './styles/fluent.css';

export default function App() {
  const [fileList, setFileList] = useState([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(false);

  const handleFilesAdded = async (newFiles) => {
    setIsLoading(true);
    const newItems = [];

    for (const file of newFiles) {
      try {
        const meta = await extractMetadata(file);
        newItems.push({ file, meta });
      } catch (err) {
        console.error('Error processing file:', file.name, err);
      }
    }

    if (newItems.length > 0) {
      setFileList(prev => [...prev, ...newItems]);
      if (fileList.length === 0) {
        setActiveIndex(0);
      }
    }
    setIsLoading(false);
  };

  const handleClearAll = () => {
    setFileList([]);
    setActiveIndex(0);
  };

  const activeItem = fileList[activeIndex] || null;
  const hasGps = Boolean(activeItem?.meta?.gpsData);

  return (
    <div className="app-container">
      <TitleBar />

      <div className="main-content">
        {fileList.length === 0 ? (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <FileDropZone onFilesAdded={handleFilesAdded} />
          </div>
        ) : (
          <>
            <Sidebar
              files={fileList}
              activeIndex={activeIndex}
              onSelectFile={setActiveIndex}
              onAddFiles={handleFilesAdded}
              onClearAll={handleClearAll}
            />

            <div className="workspace">
              {activeItem && (
                <div className={`workspace-grid ${hasGps ? '' : 'no-gps'}`}>
                  {/* Pane 1: Media Preview (JPG Photo zoom/rotate or MP4 Video Player) */}
                  <MediaPreview file={activeItem.file} meta={activeItem.meta} />

                  {/* Pane 2: Interactive GPS Map with Zoom In / Zoom Out controls (only if GPS present) */}
                  {hasGps && (
                    <MapView
                      gpsData={activeItem.meta.gpsData}
                      fileName={activeItem.file.name}
                    />
                  )}

                  {/* Pane 3: Metadata Panel with Full & Selective Tag Removal */}
                  <MetadataPanel
                    activeItem={activeItem}
                  />
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
