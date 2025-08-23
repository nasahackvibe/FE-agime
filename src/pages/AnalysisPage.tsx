import React, { useEffect, useState } from 'react';
import { useParams, Link, useLocation } from 'react-router-dom';
import { farmApi } from '../api/farms';
import type { Farm, Analysis } from '../api/farms';
import { apiClient } from '../api/client';
import { Button } from '../components/ui/button';
import { Card } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { motion } from 'framer-motion';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

// Weather emoji mapping
const getWeatherEmoji = (condition: string): string => {
  const conditionLower = condition.toLowerCase();
  if (conditionLower.includes('sunny') || conditionLower.includes('clear')) return '☀️';
  if (conditionLower.includes('cloudy') || conditionLower.includes('overcast')) return '☁️';
  if (conditionLower.includes('rain') || conditionLower.includes('drizzle')) return '🌧️';
  if (conditionLower.includes('storm') || conditionLower.includes('thunder')) return '⛈️';
  if (conditionLower.includes('snow')) return '❄️';
  if (conditionLower.includes('fog') || conditionLower.includes('mist')) return '🌫️';
  if (conditionLower.includes('partly')) return '⛅';
  return '🌤️';
};

// Animation variants
const containerVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { 
    opacity: 1, 
    y: 0,
    transition: { 
      duration: 0.6,
      staggerChildren: 0.1
    }
  }
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { 
    opacity: 1, 
    y: 0,
    transition: { duration: 0.4 }
  }
};


export const AnalysisPage: React.FC = () => {
  const { farm_id } = useParams<{ farm_id: string }>();
  const location = useLocation();
  const [farm, setFarm] = useState<Farm | null>(null);
  const [analyses, setAnalyses] = useState<Analysis[]>([]);
  const [latestAnalysis, setLatestAnalysis] = useState<Analysis | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [hasStartedFromNavigation, setHasStartedFromNavigation] = useState(false);

  // Chatbot states
  const [showChatbot, setShowChatbot] = useState(false);
  const [chatMessages, setChatMessages] = useState<Array<{
    id: string;
    message: string;
    isUser: boolean;
    timestamp: Date;
  }>>([]);
  const [chatInput, setChatInput] = useState('');
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  // Check if we have navigation state from map page
  const navigationState = location.state as {
    farmName?: string;
    farmId?: string;
    coordinates?: Array<{lat: number, lon: number}>;
  } | null;

  useEffect(() => {
    const loadData = async () => {
      // If we have navigation state, use that data and start analysis
      if (navigationState?.farmId && !analyzing && !hasStartedFromNavigation) {
        console.log('🚀 [DEBUG] Starting analysis from navigation state...');
        console.log('📋 [DEBUG] Farm data from navigation:', navigationState);
        
        // Mark as started to prevent multiple calls
        setHasStartedFromNavigation(true);
        
        // Clear navigation state immediately to prevent re-processing
        window.history.replaceState({}, document.title);
        
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
        console.log('📋 [DEBUG] Loaded analyses:', analysesData);

        // Get latest analysis
        if (analysesData.length > 0) {
          const latest = analysesData.reduce((latest, current) => 
            new Date(current.created_at) > new Date(latest.created_at) ? current : latest
          );
          console.log('📋 [DEBUG] Latest analysis:', latest);
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
      console.log('📊 [DEBUG] Analysis status:', newAnalysis.status);
      console.log('📊 [DEBUG] Analysis results:', newAnalysis.raw_llm_response);
      console.log('📊 [DEBUG] Full analysis object:', JSON.stringify(newAnalysis, null, 2));
      
      // If the API returns a successful response but status is not 'completed',
      // we should treat it as completed since the API call was successful
      if (newAnalysis && !newAnalysis.status) {
        newAnalysis.status = 'completed';
      }
      
      // Store the full analysis object to access creation time
      setAnalyses([newAnalysis, ...analyses]);
      setLatestAnalysis(newAnalysis);
    } catch (err) {
      console.error('❌ [DEBUG] Analysis failed:', err);
      setError('Failed to run analysis');
    } finally {
      setAnalyzing(false);
    }
  };

  // Chatbot API function
  const sendChatMessage = async (message: string) => {
    if (!farm_id) return;
    
    setIsChatLoading(true);
    const userMessage = {
      id: Date.now().toString(),
      message,
      isUser: true,
      timestamp: new Date()
    };
    
    setChatMessages(prev => [...prev, userMessage]);
    setChatInput('');
    
    try {
      const response = await apiClient.sendChatMessage(message, farm_id, conversationId || undefined);
      
      // Set conversation ID if it's the first message
      if (!conversationId && response.conversation_id) {
        setConversationId(response.conversation_id);
      }
      
      const botMessage = {
        id: response.message_id.toString(),
        message: response.assistant || 'Sorry, I couldn\'t process your request.',
        isUser: false,
        timestamp: new Date()
      };
      
      setChatMessages(prev => [...prev, botMessage]);
    } catch (error) {
      console.error('Chat error:', error);
      const errorMessage = {
        id: (Date.now() + 1).toString(),
        message: 'Sorry, there was an error processing your request.',
        isUser: false,
        timestamp: new Date()
      };
      setChatMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsChatLoading(false);
    }
  };

  // Load conversation history
  const loadConversationHistory = async (convId: string) => {
    setIsLoadingHistory(true);
    try {
      const history = await apiClient.getConversationHistory(convId);
      const formattedMessages = history.messages.map(msg => ({
        id: msg.id.toString(),
        message: msg.content,
        isUser: msg.role === 'user',
        timestamp: new Date(msg.created_at)
      }));
      setChatMessages(formattedMessages);
    } catch (error) {
      console.error('Failed to load conversation history:', error);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  // Handle chatbot toggle with history loading
  const handleChatbotToggle = () => {
    if (!showChatbot && conversationId) {
      // Load history when opening chatbot if we have a conversation ID
      loadConversationHistory(conversationId);
    }
    setShowChatbot(!showChatbot);
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
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-1">{farm.name}</h1>
              <p className="text-gray-600 flex items-center">
                <span className="w-2 h-2 bg-blue-500 rounded-full mr-2"></span>
                Farm Analysis Results
              </p>
            </div>
            <div className="flex items-center space-x-3">
              <Link to="/">
                <Button variant="outline" className="flex items-center">
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                  </svg>
                  Dashboard
                </Button>
              </Link>
              <Button 
                onClick={() => handleRunAnalysis()}
                disabled={analyzing}
                className="bg-blue-600 hover:bg-blue-700"
              >
                {analyzing ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Analyzing...
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                    Run New Analysis
                  </>
                )}
              </Button>
              <Button 
                onClick={handleChatbotToggle}
                className="bg-green-600 hover:bg-green-700 flex items-center"
              >
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
                {showChatbot ? 'Hide Assistant' : 'Ask Assistant'}
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto py-8 sm:px-6 lg:px-8">
        <div className="px-4 sm:px-0">
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
              <div className="flex">
                <svg className="w-5 h-5 text-red-400 mr-2 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
                <p className="text-red-800">{error}</p>
              </div>
            </div>
          )}

          {/* Latest Analysis */}
          {latestAnalysis ? (
            <div className="mb-8">
              <div className="flex items-center mb-6">
                <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center mr-3">
                  <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                </div>
                <h2 className="text-2xl font-bold text-gray-900">Latest Analysis</h2>
              </div>
              
              <Card className="overflow-hidden border-0 shadow-lg">
                <div className="bg-gradient-to-r from-blue-50 to-indigo-50 px-6 py-4 border-b">
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900 flex items-center">
                        <span className="w-2 h-2 bg-blue-500 rounded-full mr-2"></span>
                        Analysis #{latestAnalysis.id}
                      </h3>
                      <p className="text-gray-600 text-sm mt-1">
                        {latestAnalysis.created_at ? new Date(latestAnalysis.created_at).toLocaleString() : 'Date not available'}
                      </p>
                    </div>
                    <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                      latestAnalysis.status === 'completed' || latestAnalysis.raw_llm_response ? 'bg-green-100 text-green-800' :
                      latestAnalysis.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                      'bg-red-100 text-red-800'
                    }`}>
                      {latestAnalysis.status || (latestAnalysis.raw_llm_response ? 'completed' : 'unknown')}
                    </span>
                  </div>
                </div>
                
                                                                  {(latestAnalysis.status === 'completed' || latestAnalysis.raw_llm_response) ? (
                   <motion.div 
                     className="p-6 space-y-8"
                     variants={containerVariants}
                     initial="hidden"
                     animate="visible"
                   >
                                           {/* Enhanced Weather Summary with Charts */}
                     {latestAnalysis.raw_llm_response?.weather_summary && (
                       <motion.div 
                         variants={itemVariants}
                         className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-6 border border-blue-100"
                       >
                         <div className="flex items-center mb-6">
                           <motion.div 
                             className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mr-4"
                             whileHover={{ scale: 1.1 }}
                             transition={{ type: "spring", stiffness: 300 }}
                           >
                             <span className="text-2xl">
                               {getWeatherEmoji(latestAnalysis.raw_llm_response.weather_summary.current.condition)}
                             </span>
                           </motion.div>
                           <div>
                             <h4 className="text-xl font-semibold text-gray-900">Weather Summary</h4>
                             <p className="text-blue-600 capitalize">
                               {latestAnalysis.raw_llm_response.weather_summary.current.condition}
                             </p>
                           </div>
                         </div>

                         <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                           {/* Current Conditions Card */}
                           <motion.div
                             whileHover={{ y: -5 }}
                             transition={{ type: "spring", stiffness: 300 }}
                           >
                             <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-sm h-full">
                               <div className="p-6">
                                 <h5 className="font-semibold text-blue-800 mb-4 flex items-center">
                                   <span className="text-xl mr-2">🌡️</span>
                                   Current Conditions
                                 </h5>
                                 <div className="space-y-4">
                                   <div className="flex justify-between items-center p-3 bg-blue-50 rounded-lg">
                                     <span className="text-gray-700 flex items-center">
                                       <span className="mr-2">🌡️</span>
                                       Temperature
                                     </span>
                                     <span className="font-bold text-2xl text-blue-600">
                                       {latestAnalysis.raw_llm_response.weather_summary.current.temp_c}°C
                                     </span>
                                   </div>
                                   <div className="flex justify-between items-center p-3 bg-blue-50 rounded-lg">
                                     <span className="text-gray-700 flex items-center">
                                       <span className="mr-2">💧</span>
                                       Precipitation
                                     </span>
                                     <span className="font-bold text-xl text-blue-600">
                                       {latestAnalysis.raw_llm_response.weather_summary.current.precip_mm}mm
                                     </span>
                                   </div>
                                 </div>
                               </div>
                             </Card>
                           </motion.div>

                           {/* 7-Day Forecast Chart */}
                           <motion.div
                             whileHover={{ y: -5 }}
                             transition={{ type: "spring", stiffness: 300 }}
                           >
                             <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-sm h-full">
                               <div className="p-6">
                                 <h5 className="font-semibold text-blue-800 mb-4 flex items-center">
                                   <span className="text-xl mr-2">📊</span>
                                   7-Day Precipitation Forecast
                                 </h5>
                                 <ResponsiveContainer width="100%" height={200}>
                                   <BarChart data={latestAnalysis.raw_llm_response.weather_summary.next_7_days.map((day: any) => ({
                                     date: new Date(day.date).toLocaleDateString('en-US', { weekday: 'short' }),
                                     precipitation: day.precip_mm,
                                     emoji: getWeatherEmoji(day.condition || 'clear')
                                   }))}>
                                     <CartesianGrid strokeDasharray="3 3" stroke="#e0e7ff" />
                                     <XAxis 
                                       dataKey="date" 
                                       tick={{ fontSize: 12, fill: '#6b7280' }}
                                       axisLine={{ stroke: '#d1d5db' }}
                                     />
                                     <YAxis 
                                       tick={{ fontSize: 12, fill: '#6b7280' }}
                                       axisLine={{ stroke: '#d1d5db' }}
                                       label={{ value: 'mm', angle: -90, position: 'insideLeft' }}
                                     />
                                     <Tooltip 
                                       contentStyle={{ 
                                         backgroundColor: '#f8fafc', 
                                         border: '1px solid #e2e8f0',
                                         borderRadius: '8px',
                                         boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                                       }}
                                       formatter={(value: any) => [`${value}mm`, 'Precipitation']}
                                     />
                                     <Bar 
                                       dataKey="precipitation" 
                                       fill="#3b82f6"
                                       radius={[4, 4, 0, 0]}
                                     />
                                   </BarChart>
                                 </ResponsiveContainer>
                               </div>
                             </Card>
                           </motion.div>
                         </div>

                         {/* Weather Timeline */}
                         <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-sm">
                           <div className="p-6">
                             <h5 className="font-semibold text-blue-800 mb-4 flex items-center">
                               <span className="text-xl mr-2">📅</span>
                               Weekly Weather Timeline
                             </h5>
                             <div className="flex flex-wrap gap-3">
                               {latestAnalysis.raw_llm_response.weather_summary.next_7_days.map((day: any, index: number) => (
                                 <motion.div
                                   key={index}
                                   className="flex-1 min-w-[120px] bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg p-3 text-center border border-blue-200"
                                   whileHover={{ scale: 1.05 }}
                                   transition={{ type: "spring", stiffness: 300 }}
                                 >
                                   <div className="text-2xl mb-2">
                                     {getWeatherEmoji(day.condition || 'clear')}
                                   </div>
                                   <div className="text-xs font-medium text-gray-600 mb-1">
                                     {new Date(day.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                                   </div>
                                   <div className="text-sm font-bold text-blue-600">
                                     {day.precip_mm}mm
                                   </div>
                                 </motion.div>
                               ))}
                             </div>
                           </div>
                         </Card>
                       </motion.div>
                     )}

                                         {/* Enhanced Soil Summary with Charts */}
                     {latestAnalysis.raw_llm_response?.soil_summary && (
                       <motion.div 
                         variants={itemVariants}
                         className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl p-6 border border-green-100"
                       >
                         <div className="flex items-center mb-6">
                           <motion.div 
                             className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center mr-4"
                             whileHover={{ scale: 1.1 }}
                             transition={{ type: "spring", stiffness: 300 }}
                           >
                             <span className="text-2xl">🌱</span>
                           </motion.div>
                           <div>
                             <h4 className="text-xl font-semibold text-gray-900">Soil Analysis</h4>
                             <p className="text-green-600">Comprehensive soil health assessment</p>
                           </div>
                         </div>

                         <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                           {/* Soil Metrics */}
                           <motion.div
                             whileHover={{ y: -5 }}
                             transition={{ type: "spring", stiffness: 300 }}
                           >
                             <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-sm h-full">
                               <div className="p-6">
                                 <h5 className="font-semibold text-green-800 mb-4 flex items-center">
                                   <span className="text-xl mr-2">📊</span>
                                   Soil Metrics
                                 </h5>
                                 <div className="space-y-4">
                                   <div className="flex justify-between items-center p-4 bg-green-50 rounded-lg">
                                     <span className="text-gray-700 flex items-center">
                                       <span className="mr-2">🧪</span>
                                       pH Level
                                     </span>
                                     <div className="text-right">
                                       <span className="font-bold text-2xl text-green-600">
                                         {latestAnalysis.raw_llm_response.soil_summary.ph}
                                       </span>
                                       <div className="text-xs text-gray-500">
                                         {parseFloat(latestAnalysis.raw_llm_response.soil_summary.ph) < 6.5 ? 'Acidic' : 
                                          parseFloat(latestAnalysis.raw_llm_response.soil_summary.ph) > 7.5 ? 'Alkaline' : 'Neutral'}
                                       </div>
                                     </div>
                                   </div>
                                   <div className="flex justify-between items-center p-4 bg-green-50 rounded-lg">
                                     <span className="text-gray-700 flex items-center">
                                       <span className="mr-2">🏔️</span>
                                       Texture
                                     </span>
                                     <span className="font-bold text-xl text-green-600 capitalize">
                                       {latestAnalysis.raw_llm_response.soil_summary.texture}
                                     </span>
                                   </div>
                                 </div>
                               </div>
                             </Card>
                           </motion.div>

                           {/* Soil Composition Chart */}
                           <motion.div
                             whileHover={{ y: -5 }}
                             transition={{ type: "spring", stiffness: 300 }}
                           >
                             <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-sm h-full">
                               <div className="p-6">
                                 <h5 className="font-semibold text-green-800 mb-4 flex items-center">
                                   <span className="text-xl mr-2">🥧</span>
                                   Soil Composition
                                 </h5>
                                 <ResponsiveContainer width="100%" height={200}>
                                   <PieChart>
                                     <Pie
                                       data={[
                                         { name: 'Clay', value: 30, color: '#DC2626' },
                                         { name: 'Sand', value: 40, color: '#F59E0B' },
                                         { name: 'Silt', value: 20, color: '#10B981' },
                                         { name: 'Organic Matter', value: 10, color: '#8B5CF6' }
                                       ]}
                                       cx="50%"
                                       cy="50%"
                                       outerRadius={80}
                                       dataKey="value"
                                       label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                                       labelLine={false}
                                     >
                                       {[
                                         { name: 'Clay', value: 30, color: '#DC2626' },
                                         { name: 'Sand', value: 40, color: '#F59E0B' },
                                         { name: 'Silt', value: 20, color: '#10B981' },
                                         { name: 'Organic Matter', value: 10, color: '#8B5CF6' }
                                       ].map((entry, index) => (
                                         <Cell key={`cell-${index}`} fill={entry.color} />
                                       ))}
                                     </Pie>
                                     <Tooltip 
                                       contentStyle={{ 
                                         backgroundColor: '#f8fafc', 
                                         border: '1px solid #e2e8f0',
                                         borderRadius: '8px' 
                                       }}
                                     />
                                   </PieChart>
                                 </ResponsiveContainer>
                               </div>
                             </Card>
                           </motion.div>
                         </div>

                         {/* Soil Notes */}
                         <motion.div
                           whileHover={{ scale: 1.02 }}
                           transition={{ type: "spring", stiffness: 300 }}
                           className="mt-6"
                         >
                           <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-sm">
                             <div className="p-6">
                               <h5 className="font-semibold text-green-800 mb-3 flex items-center">
                                 <span className="text-xl mr-2">📝</span>
                                 Analysis Notes
                               </h5>
                               <p className="text-gray-700 leading-relaxed bg-green-50 p-4 rounded-lg">
                                 {latestAnalysis.raw_llm_response.soil_summary.notes}
                               </p>
                             </div>
                           </Card>
                         </motion.div>
                       </motion.div>
                     )}

                                         {/* Enhanced Recommended Crops with Chart */}
                     {latestAnalysis.raw_llm_response?.recommended_crops && (
                       <motion.div 
                         variants={itemVariants}
                         className="bg-gradient-to-br from-yellow-50 to-amber-50 rounded-xl p-6 border border-yellow-100"
                       >
                         <div className="flex items-center mb-6">
                           <motion.div 
                             className="w-12 h-12 bg-yellow-100 rounded-lg flex items-center justify-center mr-4"
                             whileHover={{ scale: 1.1 }}
                             transition={{ type: "spring", stiffness: 300 }}
                           >
                             <span className="text-2xl">🌾</span>
                           </motion.div>
                           <div>
                             <h4 className="text-xl font-semibold text-gray-900">Recommended Crops</h4>
                             <p className="text-yellow-600">AI-powered crop recommendations</p>
                           </div>
                         </div>

                         <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                           {/* Crop Suitability Chart */}
                           <motion.div
                             whileHover={{ y: -5 }}
                             transition={{ type: "spring", stiffness: 300 }}
                           >
                             <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-sm h-full">
                               <div className="p-6">
                                 <h5 className="font-semibold text-yellow-800 mb-4 flex items-center">
                                   <span className="text-xl mr-2">📊</span>
                                   Crop Suitability Scores
                                 </h5>
                                 <ResponsiveContainer width="100%" height={250}>
                                   <BarChart 
                                     data={latestAnalysis.raw_llm_response.recommended_crops.map((crop: any) => ({
                                       name: crop.name,
                                       score: Math.round(crop.score * 100),
                                       fullName: crop.name
                                     }))}
                                     layout="horizontal"
                                   >
                                     <CartesianGrid strokeDasharray="3 3" stroke="#fef3c7" />
                                     <XAxis 
                                       type="number" 
                                       domain={[0, 100]}
                                       tick={{ fontSize: 12, fill: '#92400e' }}
                                       axisLine={{ stroke: '#d97706' }}
                                     />
                                     <YAxis 
                                       type="category"
                                       dataKey="name" 
                                       tick={{ fontSize: 12, fill: '#92400e' }}
                                       axisLine={{ stroke: '#d97706' }}
                                       width={80}
                                     />
                                     <Tooltip 
                                       contentStyle={{ 
                                         backgroundColor: '#fffbeb', 
                                         border: '1px solid #fbbf24',
                                         borderRadius: '8px' 
                                       }}
                                       formatter={(value: any) => [`${value}%`, 'Suitability']}
                                     />
                                     <Bar 
                                       dataKey="score" 
                                       fill="#f59e0b"
                                       radius={[0, 4, 4, 0]}
                                     />
                                   </BarChart>
                                 </ResponsiveContainer>
                               </div>
                             </Card>
                           </motion.div>

                           {/* Top Crop Details */}
                           <motion.div
                             whileHover={{ y: -5 }}
                             transition={{ type: "spring", stiffness: 300 }}
                           >
                             <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-sm h-full">
                               <div className="p-6">
                                 <h5 className="font-semibold text-yellow-800 mb-4 flex items-center">
                                   <span className="text-xl mr-2">🏆</span>
                                   Top Recommendation
                                 </h5>
                                 {latestAnalysis.raw_llm_response.recommended_crops[0] && (
                                   <div className="space-y-4">
                                     <div className="text-center p-4 bg-yellow-50 rounded-lg">
                                       <h6 className="text-2xl font-bold text-yellow-700 mb-2">
                                         {latestAnalysis.raw_llm_response.recommended_crops[0].name}
                                       </h6>
                                       <div className="flex items-center justify-center mb-3">
                                         <span className="text-3xl font-bold text-yellow-600">
                                           {Math.round(latestAnalysis.raw_llm_response.recommended_crops[0].score * 100)}%
                                         </span>
                                         <span className="text-yellow-600 ml-2">match</span>
                                       </div>
                                     </div>
                                     <p className="text-sm text-gray-700 leading-relaxed bg-yellow-50 p-3 rounded-lg">
                                       {latestAnalysis.raw_llm_response.recommended_crops[0].reason}
                                     </p>
                                   </div>
                                 )}
                               </div>
                             </Card>
                           </motion.div>
                         </div>

                         {/* All Crop Cards */}
                         <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                           {latestAnalysis.raw_llm_response.recommended_crops.map((crop: any, index: number) => (
                             <motion.div
                               key={index}
                               whileHover={{ scale: 1.05, y: -5 }}
                               transition={{ type: "spring", stiffness: 300 }}
                             >
                               <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-sm hover:shadow-md transition-shadow h-full">
                                 <div className="p-4">
                                   <div className="flex justify-between items-start mb-3">
                                     <h5 className="font-semibold text-gray-900 flex items-center">
                                       <span className="text-lg mr-2">🌱</span>
                                       {crop.name}
                                     </h5>
                                     <span className="bg-yellow-100 text-yellow-800 px-3 py-1 rounded-full text-sm font-medium">
                                       {Math.round(crop.score * 100)}%
                                     </span>
                                   </div>
                                   <p className="text-sm text-gray-600 leading-relaxed">{crop.reason}</p>
                                 </div>
                               </Card>
                             </motion.div>
                           ))}
                         </div>
                       </motion.div>
                     )}

                                         {/* Enhanced Weekly Plan with Weather Integration */}
                     {latestAnalysis.raw_llm_response?.weekly_plan_template && (
                       <motion.div 
                         variants={itemVariants}
                         className="bg-gradient-to-br from-purple-50 to-violet-50 rounded-xl p-6 border border-purple-100"
                       >
                         <div className="flex items-center mb-6">
                           <motion.div 
                             className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center mr-4"
                             whileHover={{ scale: 1.1 }}
                             transition={{ type: "spring", stiffness: 300 }}
                           >
                             <span className="text-2xl">📅</span>
                           </motion.div>
                           <div>
                             <h4 className="text-xl font-semibold text-gray-900">Weekly Farming Plan</h4>
                             <p className="text-purple-600">Task-based farming schedule with weather insights</p>
                           </div>
                         </div>

                         <div className="space-y-6">
                           {Object.entries(latestAnalysis.raw_llm_response.weekly_plan_template).map(([cropName, weeks]: [string, any]) => (
                             <motion.div
                               key={cropName}
                               whileHover={{ y: -2 }}
                               transition={{ type: "spring", stiffness: 300 }}
                             >
                               <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-sm">
                                 <div className="p-6">
                                   <div className="flex items-center mb-6">
                                     <span className="text-2xl mr-3">🌾</span>
                                     <h5 className="font-semibold text-purple-800 text-lg">{cropName}</h5>
                                   </div>
                                   
                                   <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                                     {Object.entries(weeks).map(([week, tasks]: [string, any], weekIndex: number) => {
                                       // Get weather for this week if available
                                       const weatherDay = latestAnalysis.raw_llm_response?.weather_summary?.next_7_days?.[weekIndex];
                                       const weatherEmoji = weatherDay ? getWeatherEmoji('clear') : '🌤️';
                                       const precipitation = weatherDay?.precip_mm || 0;
                                       
                                       return (
                                         <motion.div
                                           key={week}
                                           className="bg-gradient-to-br from-purple-50 to-violet-50 rounded-lg p-4 border border-purple-200 hover:shadow-md transition-shadow"
                                           whileHover={{ scale: 1.02 }}
                                           transition={{ type: "spring", stiffness: 300 }}
                                         >
                                           {/* Week Header with Weather */}
                                           <div className="flex items-center justify-between mb-3">
                                             <h6 className="font-medium text-purple-700 text-sm capitalize">
                                               {week.replace('_', ' ')}
                                             </h6>
                                             <div className="flex items-center space-x-1">
                                               <span className="text-lg">{weatherEmoji}</span>
                                               {precipitation > 0 && (
                                                 <span className="text-xs text-blue-600 font-medium">
                                                   {precipitation}mm
                                                 </span>
                                               )}
                                             </div>
                                           </div>

                                           {/* Weather Alert */}
                                           {precipitation > 10 && (
                                             <div className="bg-blue-100 border border-blue-200 rounded-lg p-2 mb-3">
                                               <div className="flex items-center text-blue-700">
                                                 <span className="text-sm mr-1">💧</span>
                                                 <span className="text-xs font-medium">Heavy rain expected</span>
                                               </div>
                                             </div>
                                           )}

                                           {/* Tasks */}
                                           <div className="space-y-2">
                                             {Array.isArray(tasks) && tasks.map((task: string, taskIndex: number) => (
                                               <motion.div
                                                 key={taskIndex}
                                                 className="flex items-start p-2 bg-white/60 rounded-lg hover:bg-white/80 transition-colors"
                                                 whileHover={{ x: 2 }}
                                                 transition={{ type: "spring", stiffness: 400 }}
                                               >
                                                 <div className="flex items-center mr-2 mt-1">
                                                   <div className="w-2 h-2 bg-purple-400 rounded-full"></div>
                                                 </div>
                                                 <div className="flex-1">
                                                   <span className="text-xs text-gray-700 leading-relaxed">
                                                     {task}
                                                   </span>
                                                   {/* Weather-based task suggestions */}
                                                   {precipitation > 5 && task.toLowerCase().includes('water') && (
                                                     <div className="mt-1 text-xs text-blue-600 flex items-center">
                                                       <span className="mr-1">💡</span>
                                                       Skip watering - rain expected
                                                     </div>
                                                   )}
                                                   {precipitation > 15 && (task.toLowerCase().includes('spray') || task.toLowerCase().includes('fertilize')) && (
                                                     <div className="mt-1 text-xs text-orange-600 flex items-center">
                                                       <span className="mr-1">⚠️</span>
                                                       Postpone due to heavy rain
                                                     </div>
                                                   )}
                                                 </div>
                                               </motion.div>
                                             ))}
                                           </div>

                                           {/* Weather-based recommendations */}
                                           <div className="mt-3 pt-3 border-t border-purple-200">
                                             <div className="text-xs text-purple-600 font-medium mb-1">
                                               Weather Recommendations:
                                             </div>
                                             <div className="text-xs text-gray-600">
                                               {precipitation === 0 && '☀️ Perfect for outdoor activities'}
                                               {precipitation > 0 && precipitation <= 5 && '🌦️ Light rain - indoor tasks preferred'}
                                               {precipitation > 5 && precipitation <= 15 && '🌧️ Moderate rain - avoid spraying'}
                                               {precipitation > 15 && '⛈️ Heavy rain - postpone field work'}
                                             </div>
                                           </div>
                                         </motion.div>
                                       );
                                     })}
                                   </div>
                                 </div>
                               </Card>
                             </motion.div>
                           ))}
                         </div>
                       </motion.div>
                     )}

 
                    </motion.div>
                  ) : latestAnalysis.status === 'pending' ? (
                  <div className="p-6 text-center">
                    <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                    </div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">Analysis in Progress</h3>
                    <p className="text-gray-600">Please wait while we analyze your farm data...</p>
                  </div>
                ) : (
                  <div className="p-6 text-center">
                    <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                      <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">Analysis Failed</h3>
                    <p className="text-gray-600 mb-4">Please try running the analysis again.</p>
                    <Button onClick={() => handleRunAnalysis()} className="bg-blue-600 hover:bg-blue-700">
                      Retry Analysis
                    </Button>
                  </div>
                )}
              </Card>
            </div>
          ) : (
            <div className="mb-8">
              <Card className="overflow-hidden border-0 shadow-lg">
                <div className="bg-gradient-to-br from-gray-50 to-blue-50 p-8 text-center">
                  <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-6">
                    <svg className="w-10 h-10 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                  </div>
                  <h2 className="text-2xl font-bold text-gray-900 mb-3">No Analysis Yet</h2>
                  <p className="text-gray-600 mb-6 max-w-md mx-auto">
                    Run your first analysis to get AI-powered insights about this farm's potential.
                  </p>
                  <Button 
                    onClick={() => handleRunAnalysis()} 
                    disabled={analyzing}
                    className="bg-blue-600 hover:bg-blue-700 px-6 py-3"
                  >
                    {analyzing ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                        Analyzing...
                      </>
                    ) : (
                      <>
                        <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                        </svg>
                        Run First Analysis
                      </>
                    )}
                  </Button>
                </div>
              </Card>
            </div>
          )}

          {/* Analysis History */}
          {analyses.length > 0 && (
            <div className="mt-12">
              <div className="flex items-center mb-6">
                <div className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center mr-3">
                  <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <h2 className="text-2xl font-bold text-gray-900">Analysis History</h2>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {analyses.map((analysis) => (
                  <Card key={analysis.id} className="bg-white/80 backdrop-blur-sm border-0 shadow-sm hover:shadow-md transition-shadow">
                    <div className="p-4">
                      <div className="flex justify-between items-start mb-3">
                        <div>
                          <h3 className="font-semibold text-gray-900 flex items-center">
                            <span className="w-2 h-2 bg-blue-500 rounded-full mr-2"></span>
                            Analysis #{analysis.id}
                          </h3>
                          <p className="text-sm text-gray-600 mt-1">
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
                      <div className="flex justify-between items-center">
                        <span className="text-xs text-gray-500">
                          {analysis.raw_llm_response ? 'With detailed results' : 'Basic analysis'}
                        </span>
                        <Button size="sm" variant="outline" className="text-xs">
                          View Details
                        </Button>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Floating Chatbot */}
      {showChatbot && (
        <div className="fixed bottom-4 right-4 w-96 h-[500px] bg-white rounded-xl shadow-2xl border border-gray-200 flex flex-col z-50">
          {/* Chat Header */}
          <div className="bg-gradient-to-r from-green-600 to-green-700 text-white p-4 rounded-t-xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center mr-3">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                </div>
                <div>
                  <h3 className="font-semibold">Farm Assistant</h3>
                  <p className="text-sm opacity-90">Ask me about {farm?.name || 'your farm'}!</p>
                </div>
              </div>
              <button 
                onClick={() => setShowChatbot(false)}
                className="text-white/80 hover:text-white"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
          
          {/* Chat Messages */}
          <div className="flex-1 p-4 overflow-y-auto space-y-3">
            {isLoadingHistory ? (
              <div className="text-center text-gray-500 py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600 mx-auto mb-3"></div>
                <p className="text-sm">Loading conversation history...</p>
              </div>
            ) : chatMessages.length === 0 ? (
              <div className="text-center text-gray-500 py-8">
                <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
                  <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                </div>
                <p className="text-sm">Ask me anything about your farm!</p>
                <p className="text-xs mt-1">I can help with planting schedules, crop recommendations, and more.</p>
                <div className="mt-4 space-y-2">
                  <button 
                    onClick={() => sendChatMessage("Give me a detailed planting schedule for maize")}
                    className="block w-full text-left text-xs bg-green-50 hover:bg-green-100 p-2 rounded border text-green-700"
                  >
                    💡 "Give me a detailed planting schedule for maize"
                  </button>
                  <button 
                    onClick={() => sendChatMessage("What crops are best for my soil type?")}
                    className="block w-full text-left text-xs bg-green-50 hover:bg-green-100 p-2 rounded border text-green-700"
                  >
                    💡 "What crops are best for my soil type?"
                  </button>
                </div>
              </div>
            ) : (
              chatMessages.map((msg) => (
                <div key={msg.id} className={`flex ${msg.isUser ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
                    msg.isUser 
                      ? 'bg-green-600 text-white' 
                      : 'bg-gray-100 text-gray-900'
                  }`}>
                    <p className="text-sm">{msg.message}</p>
                    <p className={`text-xs mt-1 ${
                      msg.isUser ? 'text-green-100' : 'text-gray-500'
                    }`}>
                      {msg.timestamp.toLocaleTimeString()}
                    </p>
                  </div>
                </div>
              ))
            )}
            {isChatLoading && (
              <div className="flex justify-start">
                <div className="bg-gray-100 text-gray-900 px-4 py-2 rounded-lg">
                  <div className="flex items-center space-x-2">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-600"></div>
                    <span className="text-sm">Thinking...</span>
                  </div>
                </div>
              </div>
            )}
          </div>
          
          {/* Chat Input */}
          <div className="p-4 border-t border-gray-200">
            <form onSubmit={(e) => {
              e.preventDefault();
              if (chatInput.trim() && !isChatLoading) {
                sendChatMessage(chatInput.trim());
              }
            }}>
              <div className="flex space-x-2">
                <Input
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  placeholder="Ask about your farm..."
                  disabled={isChatLoading}
                  className="flex-1"
                />
                <Button 
                  type="submit" 
                  disabled={!chatInput.trim() || isChatLoading}
                  size="sm"
                  className="bg-green-600 hover:bg-green-700"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                  </svg>
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
