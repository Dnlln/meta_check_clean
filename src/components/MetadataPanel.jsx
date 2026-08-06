import React, { useState } from 'react';
import {
  ListFilter, Search, ShieldAlert, ShieldCheck, Trash2, Download, Sparkles, Check, FileCode, FileSpreadsheet, MapPinOff, CameraOff
} from 'lucide-react';
import { cleanAllJpgMetadata, cleanSelectiveJpgMetadata, cleanAllMp4Metadata, cleanSelectiveMp4Metadata, triggerFileDownload } from '../utils/metaCleaner';

export default function MetadataPanel({ activeItem, onMetadataUpdate }) {
  const [activeTab, setActiveTab] = useState('overview');
  const [searchQuery, setSearchQuery] = useState('');
  const [removedTagIds, setRemovedTagIds] = useState(new Set());
  const [isCleaning, setIsCleaning] = useState(false);
  const [cleanStatus, setCleanStatus] = useState('');

  if (!activeItem) return null;

  const { file, meta } = activeItem;
  const { categorized, gpsData, isJpg, isMp4 } = meta;

  // Filter raw tags based on search query and selective removal
  const allRawTags = categorized.raw || [];
  const visibleRawTags = allRawTags.filter(tag => {
    if (removedTagIds.has(tag.id)) return false;
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return tag.key.toLowerCase().includes(query) || tag.value.toLowerCase().includes(query);
  });

  // Selective single tag removal
  const handleRemoveSingleTag = (tagId) => {
    const nextSet = new Set(removedTagIds);
    nextSet.add(tagId);
    setRemovedTagIds(nextSet);
  };

  // Quick Action: Remove GPS tags
  const handleRemoveAllGps = async () => {
    setIsCleaning(true);
    try {
      let cleanedBlob;
      const gpsTags = new Set(['GPS', 'location', 'coordinates']);
      if (isJpg) {
        cleanedBlob = await cleanSelectiveJpgMetadata(file, gpsTags);
      } else {
        cleanedBlob = await cleanSelectiveMp4Metadata(file, gpsTags);
      }
      triggerFileDownload(cleanedBlob, file.name, false);
      setCleanStatus('GPS данные успешно удалены и файл скачан!');
      setTimeout(() => setCleanStatus(''), 4000);
    } catch (err) {
      alert(`Ошибка при удалении GPS: ${err.message}`);
    } finally {
      setIsCleaning(false);
    }
  };

  // Global Clean ALL Metadata
  const handleCleanAllMetadata = async () => {
    setIsCleaning(true);
    try {
      let cleanedBlob;
      if (isJpg) {
        cleanedBlob = await cleanAllJpgMetadata(file);
      } else {
        cleanedBlob = await cleanAllMp4Metadata(file);
      }
      triggerFileDownload(cleanedBlob, file.name, true);
      setCleanStatus('Все метаданные успешно очищены и файл скачан!');
      setTimeout(() => setCleanStatus(''), 4000);
    } catch (err) {
      alert(`Ошибка при полной очистке: ${err.message}`);
    } finally {
      setIsCleaning(false);
    }
  };

  // Save selectively modified file
  const handleSaveSelectiveFile = async () => {
    if (removedTagIds.size === 0) {
      alert('Вы не удалили ни одного тега. Нажмите на значок корзины напротив любого тега для выборочного удаления.');
      return;
    }
    setIsCleaning(true);
    try {
      let cleanedBlob;
      if (isJpg) {
        cleanedBlob = await cleanSelectiveJpgMetadata(file, removedTagIds);
      } else {
        cleanedBlob = await cleanSelectiveMp4Metadata(file, removedTagIds);
      }
      triggerFileDownload(cleanedBlob, file.name, false);
      setCleanStatus(`Файл с ${removedTagIds.size} удаленными тегами сохранен!`);
      setTimeout(() => setCleanStatus(''), 4000);
    } catch (err) {
      alert(`Ошибка сохранения: ${err.message}`);
    } finally {
      setIsCleaning(false);
    }
  };

  // Export JSON report
  const handleExportJson = () => {
    const jsonStr = JSON.stringify(visibleRawTags, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${file.name}_metadata.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Export CSV report
  const handleExportCsv = () => {
    const headers = ['Key', 'Group', 'Value'];
    const rows = visibleRawTags.map(t => [`"${t.key.replace(/"/g, '""')}"`, `"${(t.group || '').replace(/"/g, '""')}"`, `"${t.value.replace(/"/g, '""')}"`]);
    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${file.name}_metadata.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="pane-card meta-pane">
      {/* Pane Header with Title & Primary Clean All Button */}
      <div className="pane-header">
        <div className="pane-title">
          <ListFilter size={16} />
          <span>Инспектор метаданных</span>
        </div>

        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          {cleanStatus && (
            <span style={{ fontSize: '11px', color: '#4ade80', fontWeight: '500' }}>
              {cleanStatus}
            </span>
          )}

          <button
            className="win-btn primary"
            onClick={handleCleanAllMetadata}
            disabled={isCleaning}
            title="Полностью очистить все EXIF/QuickTime метаданные без потери качества"
          >
            <Sparkles size={13} />
            <span>Очистить ВСЕ метаданные</span>
          </button>

          {removedTagIds.size > 0 && (
            <button
              className="win-btn success"
              onClick={handleSaveSelectiveFile}
              disabled={isCleaning}
            >
              <Download size={13} />
              <span>Скачать очищенный ({removedTagIds.size})</span>
            </button>
          )}
        </div>
      </div>

      {/* Privacy Audit Banner */}
      <div style={{ padding: '8px 16px 0 16px' }}>
        {gpsData ? (
          <div className="privacy-audit-banner warning">
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <ShieldAlert size={18} style={{ color: '#ffb900' }} />
              <div>
                <strong>Внимание к приватности:</strong> В файле обнаружены точные GPS координаты ({gpsData.formatted}).
              </div>
            </div>
            <button className="win-btn danger sm" onClick={handleRemoveAllGps}>
              <MapPinOff size={12} />
              <span>Удалить только GPS</span>
            </button>
          </div>
        ) : (
          <div className="privacy-audit-banner safe">
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <ShieldCheck size={18} style={{ color: '#4ade80' }} />
              <div>GPS геоданные отсутствуют. Данные местоположения защищены.</div>
            </div>
          </div>
        )}
      </div>

      <div className="metadata-wrapper">
        {/* Toolbar with Search and Export Buttons */}
        <div className="metadata-toolbar">
          <div className="search-box">
            <Search size={14} style={{ color: 'var(--win-text-muted)' }} />
            <input
              type="text"
              placeholder="Поиск по названию или значению тега..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <div style={{ display: 'flex', gap: '6px' }}>
            <button className="win-btn sm" onClick={handleExportJson} title="Экспортировать метаданные в JSON">
              <FileCode size={13} /> JSON
            </button>
            <button className="win-btn sm" onClick={handleExportCsv} title="Экспортировать метаданные в CSV">
              <FileSpreadsheet size={13} /> CSV
            </button>
          </div>
        </div>

        {/* Tab Headers */}
        <div className="tabs-header">
          <button
            className={`tab-btn ${activeTab === 'overview' ? 'active' : ''}`}
            onClick={() => setActiveTab('overview')}
          >
            Обзор ({categorized.overview.length})
          </button>
          <button
            className={`tab-btn ${activeTab === 'camera' ? 'active' : ''}`}
            onClick={() => setActiveTab('camera')}
          >
            Камера ({categorized.camera.length})
          </button>
          <button
            className={`tab-btn ${activeTab === 'location' ? 'active' : ''}`}
            onClick={() => setActiveTab('location')}
          >
            GPS ({categorized.location.length})
          </button>
          <button
            className={`tab-btn ${activeTab === 'technical' ? 'active' : ''}`}
            onClick={() => setActiveTab('technical')}
          >
            Спецификации ({categorized.technical.length})
          </button>
          <button
            className={`tab-btn ${activeTab === 'raw' ? 'active' : ''}`}
            onClick={() => setActiveTab('raw')}
          >
            Все теги ({visibleRawTags.length})
          </button>
        </div>

        {/* Tab Content & Metadata Table */}
        <div className="meta-scroll-body">
          {activeTab === 'overview' && (
            <table className="meta-table">
              <thead>
                <tr>
                  <th>Параметр</th>
                  <th>Значение</th>
                </tr>
              </thead>
              <tbody>
                {categorized.overview.map((item, idx) => (
                  <tr key={idx}>
                    <td className="meta-key">{item.key}</td>
                    <td className="meta-val">{item.value}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {activeTab === 'camera' && (
            <table className="meta-table">
              <thead>
                <tr>
                  <th>Тег камеры</th>
                  <th>Значение</th>
                  <th className="tag-action-cell">Удалить</th>
                </tr>
              </thead>
              <tbody>
                {categorized.camera.length === 0 ? (
                  <tr>
                    <td colSpan="3" style={{ textAlign: 'center', color: 'var(--win-text-muted)', padding: '20px' }}>
                      Информация о камере не найдена
                    </td>
                  </tr>
                ) : (
                  categorized.camera.map((item, idx) => (
                    <tr key={idx} style={{ opacity: removedTagIds.has(item.id) ? 0.3 : 1 }}>
                      <td className="meta-key">{item.key}</td>
                      <td className="meta-val">{item.value}</td>
                      <td className="tag-action-cell">
                        <button
                          className="win-icon-btn danger"
                          title="Удалить этот тег"
                          onClick={() => handleRemoveSingleTag(item.id)}
                        >
                          <Trash2 size={13} />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}

          {activeTab === 'location' && (
            <table className="meta-table">
              <thead>
                <tr>
                  <th>GPS Тег</th>
                  <th>Значение</th>
                  <th className="tag-action-cell">Удалить</th>
                </tr>
              </thead>
              <tbody>
                {categorized.location.length === 0 ? (
                  <tr>
                    <td colSpan="3" style={{ textAlign: 'center', color: 'var(--win-text-muted)', padding: '20px' }}>
                      GPS геоданные отсутствуют
                    </td>
                  </tr>
                ) : (
                  categorized.location.map((item, idx) => (
                    <tr key={idx} style={{ opacity: removedTagIds.has(item.id) ? 0.3 : 1 }}>
                      <td className="meta-key">{item.key}</td>
                      <td className="meta-val">{item.value}</td>
                      <td className="tag-action-cell">
                        <button
                          className="win-icon-btn danger"
                          title="Удалить этот тег"
                          onClick={() => handleRemoveSingleTag(item.id)}
                        >
                          <Trash2 size={13} />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}

          {activeTab === 'technical' && (
            <table className="meta-table">
              <thead>
                <tr>
                  <th>Технический тег</th>
                  <th>Значение</th>
                  <th className="tag-action-cell">Удалить</th>
                </tr>
              </thead>
              <tbody>
                {categorized.technical.map((item, idx) => (
                  <tr key={idx} style={{ opacity: removedTagIds.has(item.id) ? 0.3 : 1 }}>
                    <td className="meta-key">{item.key}</td>
                    <td className="meta-val">{item.value}</td>
                    <td className="tag-action-cell">
                      <button
                        className="win-icon-btn danger"
                        title="Удалить этот тег"
                        onClick={() => handleRemoveSingleTag(item.id)}
                      >
                        <Trash2 size={13} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {activeTab === 'raw' && (
            <table className="meta-table">
              <thead>
                <tr>
                  <th>Имя тега</th>
                  <th>Группа</th>
                  <th>Значение</th>
                  <th className="tag-action-cell">Удалить</th>
                </tr>
              </thead>
              <tbody>
                {visibleRawTags.length === 0 ? (
                  <tr>
                    <td colSpan="4" style={{ textAlign: 'center', color: 'var(--win-text-muted)', padding: '20px' }}>
                      Теги не найдены или удалены
                    </td>
                  </tr>
                ) : (
                  visibleRawTags.map((item, idx) => (
                    <tr key={idx}>
                      <td className="meta-key">{item.rawKey || item.key}</td>
                      <td><span style={{ background: 'rgba(255,255,255,0.06)', padding: '2px 6px', borderRadius: '4px', fontSize: '11px' }}>{item.group || 'EXIF'}</span></td>
                      <td className="meta-val">{item.value}</td>
                      <td className="tag-action-cell">
                        <button
                          className="win-icon-btn danger"
                          title="Выборочно удалить этот тег"
                          onClick={() => handleRemoveSingleTag(item.id)}
                        >
                          <Trash2 size={13} />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
