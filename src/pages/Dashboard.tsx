import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { farmApi } from '../api/farms';
import type { Farm } from '../api/farms';
import { Button } from '../components/ui/button';
import { Card } from '../components/ui/card';
import { useToast } from '../components/ui/toast';

export const Dashboard: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { showToast } = useToast();
  const [farms, setFarms] = useState<Farm[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [analysisData, setAnalysisData] = useState<any>(null);
  const [showAnalysisResults, setShowAnalysisResults] = useState(false);

  // Check if we have navigation state from map page
  const navigationState = location.state as {
    farmName?: string;
    farmId?: string;
    coordinates?: Array<{lat: number, lon: number}>;
    showAnalysis?: boolean;
  } | null;

  useEffect(() => {
    const loadFarms = async () => {
      try {
        const farmsData = await farmApi.getFarms();
        setFarms(farmsData);
        
        // If we have navigation state with analysis flag, start analysis
        if (navigationState?.showAnalysis && navigationState?.farmId) {
          console.log('🚀 [DEBUG] Starting analysis from dashboard...');
          console.log('📋 [DEBUG] Farm data from navigation:', navigationState);
          
          // Start the analysis
          await startAnalysis(navigationState.farmId);
        }
        
        // If no farms are returned, redirect to map with a message
        if (farmsData.length === 0) {
          showToast('No farms found. Please create your first farm to get started!', 'info');
          setTimeout(() => {
            navigate('/map');
          }, 2000); // Give user time to read the message
        }
      } catch (err) {
        setError('Failed to load farms');
        console.error('Error loading farms:', err);
      } finally {
        setLoading(false);
      }
    };

    loadFarms();
  }, [navigate, showToast, navigationState]);

  // Function to start analysis and display results
  const startAnalysis = async (farmId: string) => {
    try {
      console.log('🔍 [DEBUG] Running analysis for farm:', farmId);
      const analysis = await farmApi.analyzeFarm(farmId);
      console.log('✅ [DEBUG] Analysis completed:', analysis);
      
      setAnalysisData(analysis.results);
      setShowAnalysisResults(true);
      
      showToast('Farm analysis completed successfully!', 'success');
    } catch (err) {
      console.error('❌ [DEBUG] Analysis failed:', err);
      showToast('Failed to run farm analysis', 'error');
    }
  };

  const handleLogout = () => {
    logout();
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
            <div className="flex items-center space-x-4">
              <span className="text-gray-700">Welcome, {user?.username}</span>
              <Button onClick={handleLogout} variant="outline">
                Logout
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
            <Card className="p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-2">Total Farms</h3>
              <p className="text-3xl font-bold text-blue-600">{farms.length}</p>
            </Card>
            
            <Card className="p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-2">Quick Actions</h3>
              <div className="space-y-2">
                <Link to="/map">
                  <Button className="w-full">Create New Farm</Button>
                </Link>
              </div>
            </Card>
          </div>

          <div className="bg-white shadow rounded-lg">
            <div className="px-4 py-5 sm:p-6">
              <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">
                Your Farms
              </h3>
              
              {error && (
                <div className="bg-red-50 border border-red-200 rounded-md p-4 mb-4">
                  <p className="text-red-800">{error}</p>
                </div>
              )}

              {farms.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-gray-500 mb-4">No farms yet. Create your first farm!</p>
                  <Link to="/map">
                    <Button>Create Farm</Button>
                  </Link>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {farms.map((farm) => (
                    <Card key={farm.id} className="p-4">
                      <div className="flex justify-between items-start mb-2">
                        <h4 className="text-lg font-medium text-gray-900">{farm.name}</h4>
                        <span className="text-sm text-gray-500">
                          {farm.area_m2.toFixed(2)} m²
                        </span>
                      </div>
                      <div className="text-sm text-gray-600 mb-2">
                        <p>Centroid: {farm.centroid.lat.toFixed(4)}, {farm.centroid.lon.toFixed(4)}</p>
                        <p>Created: {new Date(farm.created_at).toLocaleDateString()}</p>
                      </div>
                      <div className="flex space-x-2">
                        <Link to={`/analysis/${farm.id}`}>
                          <Button size="sm" variant="outline">
                            View Analysis
                          </Button>
                        </Link>
                        <Button 
                          size="sm" 
                          onClick={async () => {
                            try {
                              await farmApi.analyzeFarm(farm.id);
                              showToast('Farm analysis started successfully!', 'success');
                            } catch (err) {
                              console.error('Analysis failed:', err);
                              showToast('Failed to start farm analysis', 'error');
                            }
                          }}
                        >
                          Analyze
                        </Button>
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Analysis Results */}
          {showAnalysisResults && analysisData && (
            <div className="mt-8 bg-white shadow rounded-lg">
              <div className="px-4 py-5 sm:p-6">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg leading-6 font-medium text-gray-900">
                    🌱 Farm Analysis Results
                  </h3>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => setShowAnalysisResults(false)}
                  >
                    Close
                  </Button>
                </div>
                
                <div className="bg-gray-50 rounded-lg p-4 border">
                  <div className="flex justify-between items-center mb-3">
                    <h4 className="text-md font-medium text-gray-900">
                      Analysis Data (JSON)
                    </h4>
                    <Button 
                      size="sm"
                      onClick={() => {
                        navigator.clipboard.writeText(JSON.stringify(analysisData, null, 2));
                        showToast('JSON copied to clipboard!', 'success');
                      }}
                    >
                      Copy JSON
                    </Button>
                  </div>
                  
                  <div className="bg-white rounded border p-4 max-h-96 overflow-auto">
                    <pre className="text-sm text-gray-800 whitespace-pre-wrap">
                      {JSON.stringify(analysisData, null, 2)}
                    </pre>
                  </div>
                  
                  <div className="mt-4 text-sm text-gray-600">
                    <p><strong>Analysis includes:</strong></p>
                    <ul className="list-disc list-inside mt-2 space-y-1">
                      <li>Weather summary and forecast</li>
                      <li>Soil analysis and characteristics</li>
                      <li>Recommended crops with match scores</li>
                      <li>Weekly farming plan template</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};
