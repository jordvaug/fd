import React, { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import './App.css';
import FIRE_DISTRICT_ZONES from './fireDistrictZones';

// Replace with your Mapbox access token
mapboxgl.accessToken = 'pk.eyJ1Ijoiam9yZHZhdWciLCJhIjoiY21ncmVsejlkMDVzMjJqcHZsOWN3YWNtMiJ9.SNC6R8RPSRAXm5Fbxt7w5g';

// Color palette for the 10 fire districts
const DISTRICT_COLORS = [
  '#FF6B6B', // District 1 - Red
  '#4ECDC4', // District 2 - Teal
  '#45B7D1', // District 3 - Blue
  '#96CEB4', // District 4 - Green
  '#FFEAA7', // District 5 - Yellow
  '#DFE6E9', // District 6 - Gray
  '#74B9FF', // District 7 - Light Blue
  '#A29BFE', // District 8 - Purple
  '#FD79A8', // District 9 - Pink
  '#FDCB6E'  // District 10 - Orange
];

// Map the fire district zones with colors
const ZONES = FIRE_DISTRICT_ZONES.map((zone, index) => ({
  ...zone,
  color: DISTRICT_COLORS[index % DISTRICT_COLORS.length]
}));

// Point-in-polygon algorithm to check if coordinates are inside a zone
function isPointInPolygon(point, polygon) {
  const [lng, lat] = point;
  let inside = false;

  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i][0], yi = polygon[i][1];
    const xj = polygon[j][0], yj = polygon[j][1];

    const intersect = ((yi > lat) !== (yj > lat)) &&
      (lng < (xj - xi) * (lat - yi) / (yj - yi) + xi);

    if (intersect) inside = !inside;
  }

  return inside;
}

function App() {
  const mapContainer = useRef(null);
  const map = useRef(null);
  const marker = useRef(null);
  const [lng, setLng] = useState(-122.2015);
  const [lat, setLat] = useState(47.6101);
  const [zoom, setZoom] = useState(12);
  const [address, setAddress] = useState('');
  const [currentZone, setCurrentZone] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Initialize map
  useEffect(() => {
    if (map.current) return; // Initialize map only once

    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/streets-v12',
      center: [lng, lat],
      zoom: zoom
    });

    // Add navigation controls
    map.current.addControl(new mapboxgl.NavigationControl(), 'top-right');

    // Add zones to map once it's loaded
    map.current.on('load', () => {
      ZONES.forEach(zone => {
        // Add zone polygon
        map.current.addSource(zone.id, {
          type: 'geojson',
          data: {
            type: 'Feature',
            geometry: {
              type: 'Polygon',
              coordinates: zone.coordinates
            }
          }
        });

        // Add fill layer
        map.current.addLayer({
          id: `${zone.id}-fill`,
          type: 'fill',
          source: zone.id,
          paint: {
            'fill-color': zone.color,
            'fill-opacity': 0.3
          }
        });

        // Add outline layer
        map.current.addLayer({
          id: `${zone.id}-outline`,
          type: 'line',
          source: zone.id,
          paint: {
            'line-color': zone.color,
            'line-width': 2
          }
        });

        // Add label
        const center = calculatePolygonCenter(zone.coordinates[0]);
        new mapboxgl.Marker({ color: zone.color })
          .setLngLat(center)
          .setPopup(new mapboxgl.Popup().setHTML(`<strong>${zone.name}</strong>`))
          .addTo(map.current);
      });
    });
  }, []);

  // Calculate polygon center for label placement
  function calculatePolygonCenter(coordinates) {
    let x = 0, y = 0;
    coordinates.forEach(coord => {
      x += coord[0];
      y += coord[1];
    });
    return [x / coordinates.length, y / coordinates.length];
  }

  // Find which zone contains the point
  function findZone(coordinates) {
    for (const zone of ZONES) {
      if (isPointInPolygon(coordinates, zone.coordinates[0])) {
        return zone;
      }
    }
    return null;
  }

  // Geocode address and update map
  async function handleAddressSearch(e) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setCurrentZone(null);

    try {
      // Use Mapbox Geocoding API
      const response = await fetch(
        `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(address)}.json?access_token=${mapboxgl.accessToken}&limit=1`
      );

      const data = await response.json();

      if (data.features && data.features.length > 0) {
        const [lng, lat] = data.features[0].center;

        // Update map view
        map.current.flyTo({
          center: [lng, lat],
          zoom: 14,
          duration: 2000
        });

        // Remove old marker if exists
        if (marker.current) {
          marker.current.remove();
        }

        // Add new marker
        marker.current = new mapboxgl.Marker({ color: '#FF0000' })
          .setLngLat([lng, lat])
          .setPopup(new mapboxgl.Popup().setHTML(`<strong>${data.features[0].place_name}</strong>`))
          .addTo(map.current);

        // Determine zone
        const zone = findZone([lng, lat]);
        setCurrentZone(zone);

        setLng(lng);
        setLat(lat);
      } else {
        setError('Address not found. Please try a different address.');
      }
    } catch (err) {
      setError('Error geocoding address. Please try again.');
      console.error('Geocoding error:', err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="app">
      <div className="sidebar">
        <div className="sidebar-content">
          <h1>Bellevue FD Zone Finder</h1>
          <p className="description">
            Enter an address to find out which fire district zone it belongs to.
          </p>

          <form onSubmit={handleAddressSearch}>
            <input
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Enter an address..."
              className="address-input"
              disabled={loading}
            />
            <button type="submit" disabled={loading || !address.trim()}>
              {loading ? 'Searching...' : 'Search'}
            </button>
          </form>

          {error && (
            <div className="error-message">
              {error}
            </div>
          )}

          {currentZone && (
            <div className="zone-info" style={{ borderLeftColor: currentZone.color }}>
              <h2>Zone Found!</h2>
              <p className="zone-name">{currentZone.name}</p>
              <p className="zone-id">Zone ID: {currentZone.id}</p>
            </div>
          )}

          {!loading && !currentZone && !error && address && (
            <div className="zone-info no-zone">
              <p>Address not found in any defined zone.</p>
            </div>
          )}

          <div className="zones-list">
            <h3>Available Zones</h3>
            <ul>
              {ZONES.map(zone => (
                <li key={zone.id}>
                  <span className="zone-color" style={{ backgroundColor: zone.color }}></span>
                  {zone.name}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      <div ref={mapContainer} className="map-container" />
    </div>
  );
}

export default App;
