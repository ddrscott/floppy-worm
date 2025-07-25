import { useParams } from '@remix-run/react';
import { useEffect, useState } from 'react';
import { ClientOnly } from '~/components/ClientOnly';
import { TestGame } from '~/components/TestGame';

export default function TestMap() {
  const { filename } = useParams();
  const [mapData, setMapData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadMapData = async () => {
      if (!filename) {
        setError('No filename provided');
        setLoading(false);
        return;
      }

      try {
        // Load from the server API (add .json extension)
        const response = await fetch(`/api/maps/${filename}.json`);
        
        if (response.ok) {
          const result = await response.json();
          if (result.mapData) {
            setMapData(result.mapData);
          } else {
            setError('No map data received');
          }
        } else {
          setError(`Map "${filename}" not found`);
        }
      } catch (err) {
        console.error('Failed to load map:', err);
        setError('Failed to load map data');
      } finally {
        setLoading(false);
      }
    };

    loadMapData();
  }, [filename]);

  if (!filename) {
    return <div>No filename provided</div>;
  }

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        background: '#232333',
        color: 'white'
      }}>
        Loading test map: {filename}...
      </div>
    );
  }

  if (error || !mapData) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        background: '#232333',
        color: 'red',
        flexDirection: 'column'
      }}>
        <h2>Error Loading Map</h2>
        <p>{error || 'Map not found'}</p>
        <button 
          onClick={() => window.location.href = '/'} 
          style={{ 
            marginTop: '20px', 
            padding: '10px 20px',
            background: '#444',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          Back to Home
        </button>
      </div>
    );
  }
  
  return (
    <ClientOnly
      fallback={
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          height: '100vh',
          background: '#232333',
          color: 'white'
        }}>
          Loading test map: {filename}...
        </div>
      }
    >
      <TestGame filename={filename!} mapData={mapData} />
    </ClientOnly>
  );
}