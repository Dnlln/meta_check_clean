import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import { MapPin, Navigation, Copy, Check, Compass } from 'lucide-react';
import { reverseGeocode } from '../utils/geoUtils';

export default function MapView({ gpsData, fileName }) {
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markerRef = useRef(null);

  const [addressInfo, setAddressInfo] = useState(null);
  const [copied, setCopied] = useState(false);
  const [currentZoom, setCurrentZoom] = useState(15);

  useEffect(() => {
    if (!gpsData || !mapContainerRef.current) return;

    const { lat, lng } = gpsData;

    // Initialize Leaflet map if not created
    if (!mapInstanceRef.current) {
      const map = L.map(mapContainerRef.current, {
        zoomControl: false, // Custom styled zoom controls
        attributionControl: false
      }).setView([lat, lng], 15);

      // Dark Mode Map Tiles (CartoDB Dark Matter or OpenStreetMap)
      L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        maxZoom: 19,
        subdomains: 'abcd'
      }).addTo(map);

      mapInstanceRef.current = map;

      // Track zoom level changes
      map.on('zoomend', () => {
        setCurrentZoom(map.getZoom());
      });
    } else {
      mapInstanceRef.current.setView([lat, lng], 15);
    }

    const map = mapInstanceRef.current;

    // Custom Icon Pin
    const customIcon = L.divIcon({
      className: 'custom-map-pin',
      html: `
        <div style="
          width: 32px;
          height: 32px;
          background: #0078d4;
          border: 2px solid #ffffff;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 4px 14px rgba(0,120,212,0.6);
          color: white;
        ">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
            <circle cx="12" cy="10" r="3"></circle>
          </svg>
        </div>
      `,
      iconSize: [32, 32],
      iconAnchor: [16, 32],
      popupAnchor: [0, -32]
    });

    // Update marker
    if (markerRef.current) {
      markerRef.current.setLatLng([lat, lng]);
    } else {
      markerRef.current = L.marker([lat, lng], { icon: customIcon }).addTo(map);
    }

    // Bind popup
    markerRef.current.bindPopup(`
      <div style="padding: 4px; font-family: Segoe UI, sans-serif;">
        <strong style="color: #4cc9f0; font-size: 13px;">${fileName}</strong><br/>
        <div style="font-size: 11px; margin-top: 4px; color: #ddd;">
          <strong>Широта:</strong> ${lat.toFixed(6)}°<br/>
          <strong>Долгота:</strong> ${lng.toFixed(6)}°<br/>
          ${gpsData.altitude ? `<strong>Высота:</strong> ${gpsData.altitude}` : ''}
        </div>
      </div>
    `, { className: 'custom-map-popup' }).openPopup();

    // Fetch reverse geocoding
    reverseGeocode(lat, lng).then(data => {
      if (data) {
        setAddressInfo(data.displayName);
      }
    });

  }, [gpsData, fileName]);

  const handleZoomIn = () => {
    if (mapInstanceRef.current) {
      mapInstanceRef.current.zoomIn();
    }
  };

  const handleZoomOut = () => {
    if (mapInstanceRef.current) {
      mapInstanceRef.current.zoomOut();
    }
  };

  const handleCopyCoords = () => {
    if (gpsData) {
      navigator.clipboard.writeText(`${gpsData.lat}, ${gpsData.lng}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (!gpsData) {
    return (
      <div className="pane-card map-pane">
        <div className="pane-header">
          <div className="pane-title">
            <MapPin size={16} />
            <span>Карта геолокации</span>
          </div>
        </div>
        <div className="pane-content" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--win-text-muted)', gap: '12px' }}>
          <Compass size={48} style={{ opacity: 0.3 }} />
          <span style={{ fontSize: '13px' }}>GPS координаты отсутствуют в этом файле</span>
        </div>
      </div>
    );
  }

  return (
    <div className="pane-card map-pane">
      <div className="pane-header">
        <div className="pane-title">
          <MapPin size={16} style={{ color: '#4cc9f0' }} />
          <span>Карта GPS ({gpsData.formatted})</span>
        </div>
        <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
          <button className="win-btn sm" onClick={handleCopyCoords}>
            {copied ? <Check size={12} style={{ color: '#4ade80' }} /> : <Copy size={12} />}
            <span>{copied ? 'Скопировано!' : 'Координаты'}</span>
          </button>
          <div style={{ display: 'flex', gap: '2px', marginLeft: '6px' }}>
            <button className="win-btn sm" onClick={handleZoomOut} title="Уменьшить Zoom Out">
              -
            </button>
            <span style={{ fontSize: '11px', color: 'var(--win-text-muted)', display: 'inline-flex', alignItems: 'center', padding: '0 4px' }}>
              Z{currentZoom}
            </span>
            <button className="win-btn sm" onClick={handleZoomIn} title="Увеличить Zoom In">
              +
            </button>
          </div>
        </div>
      </div>

      <div className="pane-content" style={{ position: 'relative' }}>
        <div ref={mapContainerRef} style={{ width: '100%', height: '100%' }} />

        {addressInfo && (
          <div style={{
            position: 'absolute',
            bottom: '10px',
            left: '10px',
            right: '10px',
            background: 'rgba(20, 20, 26, 0.9)',
            backdropFilter: 'blur(10px)',
            border: '1px solid var(--win-border-light)',
            borderRadius: 'var(--win-radius-md)',
            padding: '8px 12px',
            fontSize: '11px',
            color: 'var(--win-text-primary)',
            zIndex: 400,
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            <Navigation size={14} style={{ color: 'var(--win-accent)', flexShrink: 0 }} />
            <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {addressInfo}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
