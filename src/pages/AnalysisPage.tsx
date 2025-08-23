import React, { useEffect, useState } from 'react';
import { useParams, Link, useLocation } from 'react-router-dom';
import { farmApi } from '../api/farms';
import type { Farm, Analysis } from '../api/farms';
import { Button } from '../components/ui/button';
import { Card } from '../components/ui/card';

export const AnalysisPage: React.FC = () => {
  const { farm_id } = useParams<{ farm_id: string }>();
  const location = useLocation();
  const [farm, setFarm] = useState<Farm | null>(null);
  const [analyses, setAnalyses] = useState<Analysis[]>([]);
  const [latestAnalysis, setLatestAnalysis] = useState<Analysis | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);

  // Check if we have navigation state from map page
  const navigationState = location.state as {
    farmName?: string;
    farmId?: string;
    coordinates?: Array<{lat: number, lon: number}>;
  } | null;

  useEffect(() => {
    const loadData = async () => {
      // If we have navigation state, use that data and start analysis
      if (navigationState?.farmId) {
        console.log('🚀 [DEBUG] Starting analysis from navigation state...');
        console.log('📋 [DEBUG] Farm data from navigation:', navigationState);
        
        // Create a temporary farm object from navigation state
        const tempFarm: Farm = {
          id: navigationState.farmId,
          name: navigationState.farmName || 'New Farm',
          centroid: {
            lat: navigationState.coordinates?.[0]?.lat || 0,
            lon: navigationState.coordinates?.[0]?.lon || 0
          },
          area_m2: 0,
          created_at: new Date().toISOString()
        };
        
        setFarm(tempFarm);
        setLoading(false);
        
        // Automatically start analysis
        await handleRunAnalysis(navigationState.farmId);
        return;
      }

      // Otherwise, load from URL params
      if (!farm_id) return;

      try {
        // Load farm details and analyses in parallel
        const [farmData, analysesData] = await Promise.all([
          farmApi.getFarm(farm_id),
          farmApi.getAnalyses(farm_id),
        ]);

        setFarm(farmData);
        setAnalyses(analysesData);

        // Get latest analysis
        if (analysesData.length > 0) {
          const latest = analysesData.reduce((latest, current) => 
            new Date(current.created_at) > new Date(latest.created_at) ? current : latest
          );
          setLatestAnalysis(latest);
        }
      } catch (err) {
        setError('Failed to load farm analysis data');
        console.error('Error loading analysis:', err);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [farm_id, navigationState]);

  const handleRunAnalysis = async (farmId?: string) => {
    const targetFarmId = farmId || farm_id;
    if (!targetFarmId) return;

    setAnalyzing(true);
    try {
      console.log('🔍 [DEBUG] Running analysis for farm:', targetFarmId);
      const newAnalysis = await farmApi.analyzeFarm(targetFarmId);
      console.log('✅ [DEBUG] Analysis completed:', newAnalysis);
      
      setAnalyses([newAnalysis, ...analyses]);
      setLatestAnalysis(newAnalysis);
    } catch (err) {
      console.error('❌ [DEBUG] Analysis failed:', err);
      setError('Failed to run analysis');
    } finally {
      setAnalyzing(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  if (!farm) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Farm not found</h2>
          <Link to="/">
            <Button>Back to Dashboard</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">{farm.name}</h1>
              <p className="text-gray-600">Farm Analysis Results</p>
            </div>
            <div className="flex items-center space-x-4">
              <Link to="/">
                <Button variant="outline">Back to Dashboard</Button>
              </Link>
              <Button 
                onClick={() => handleRunAnalysis()}
                disabled={analyzing}
              >
                {analyzing ? 'Analyzing...' : 'Run New Analysis'}
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-md p-4 mb-6">
              <p className="text-red-800">{error}</p>
            </div>
          )}

          {/* Latest Analysis */}
          {latestAnalysis ? (
            <div className="mb-8">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">Latest Analysis</h2>
              <Card className="p-6">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="text-lg font-medium text-gray-900">
                      Analysis #{latestAnalysis.id}
                    </h3>
                    <p className="text-gray-600">
                      {new Date(latestAnalysis.created_at).toLocaleString()}
                    </p>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                    latestAnalysis.status === 'completed' ? 'bg-green-100 text-green-800' :
                    latestAnalysis.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                    'bg-red-100 text-red-800'
                  }`}>
                    {latestAnalysis.status}
                  </span>
                </div>
                
                {latestAnalysis.status === 'completed' && latestAnalysis.results ? (
                  <div className="bg-gray-50 rounded-lg p-4">
                    <pre className="text-sm text-gray-800 overflow-auto">
                      {JSON.stringify(latestAnalysis.results, null, 2)}
                    </pre>
                  </div>
                ) : latestAnalysis.status === 'pending' ? (
                  <div className="text-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto mb-4"></div>
                    <p className="text-gray-600">Analysis in progress...</p>
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <p className="text-red-600">Analysis failed. Please try running it again.</p>
                  </div>
                )}
              </Card>
            </div>
          ) : (
            <div className="mb-8">
              <Card className="p-8 text-center">
                <h2 className="text-2xl font-bold text-gray-900 mb-4">No Analysis Yet</h2>
                <p className="text-gray-600 mb-6">
                  Run your first analysis to get AI insights about this farm.
                </p>
                <Button onClick={() => handleRunAnalysis()} disabled={analyzing}>
                  {analyzing ? 'Analyzing...' : 'Run First Analysis'}
                </Button>
              </Card>
            </div>
          )}

          {/* Analysis History */}
          {analyses.length > 0 && (
            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-4">Analysis History</h2>
              <div className="space-y-4">
                {analyses.map((analysis) => (
                  <Card key={analysis.id} className="p-4">
                    <div className="flex justify-between items-center">
                      <div>
                        <h3 className="font-medium text-gray-900">
                          Analysis #{analysis.id}
                        </h3>
                        <p className="text-sm text-gray-600">
                          {new Date(analysis.created_at).toLocaleString()}
                        </p>
                      </div>
                      <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                        analysis.status === 'completed' ? 'bg-green-100 text-green-800' :
                        analysis.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-red-100 text-red-800'
                      }`}>
                        {analysis.status}
                      </span>
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};
