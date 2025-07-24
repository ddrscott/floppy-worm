import { Link } from "@remix-run/react";
import { useEffect, useState } from "react";

interface MapData {
  filename: string;
  title: string;
  difficulty: number;
  lastModified: string;
  error?: string;
}

export default function MapsIndex() {
  const [maps, setMaps] = useState<MapData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Load maps data directly from the filesystem via API
    const loadMaps = async () => {
      try {
        const response = await fetch('/api/maps');
        
        if (response.ok) {
          const result = await response.json();
          if (result.maps) {
            setMaps(result.maps);
          } else if (result.error) {
            setError(result.error);
          }
        } else {
          setError('Failed to fetch maps from server');
        }
      } catch (err) {
        console.error('Failed to load maps:', err);
        setError('Failed to load maps from server');
      } finally {
        setLoading(false);
      }
    };

    loadMaps();
  }, []);

  if (loading) {
    return (
      <div className="p-8 max-w-4xl mx-auto">
        <div className="flex justify-center items-center min-h-64">
          <div className="text-gray-600">Loading maps...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8 max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-red-600 mb-4">Error</h1>
        <p className="text-gray-600">{error}</p>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-gray-800">Map Editor</h1>
        <Link
          to="/"
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
        >
          Back to Game
        </Link>
      </div>
      
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Map
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Title
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Difficulty
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Last Modified
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {maps.map((map) => (
              <tr key={map.filename} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                  {map.filename}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {map.title}
                  {map.error && (
                    <span className="ml-2 text-red-500 text-xs">({map.error})</span>
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {'★'.repeat(map.difficulty)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {new Date(map.lastModified).toLocaleDateString()}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                  <Link
                    to={`/maps/${encodeURIComponent(map.filename)}/edit`}
                    className="text-indigo-600 hover:text-indigo-900 mr-4"
                  >
                    Edit
                  </Link>
                  <Link
                    to={`/maps/${encodeURIComponent(map.filename)}`}
                    className="text-green-600 hover:text-green-900"
                  >
                    View
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        
        {maps.length === 0 && (
          <div className="text-center py-12">
            <p className="text-gray-500">No maps found in the data directory.</p>
          </div>
        )}
      </div>
    </div>
  );
}