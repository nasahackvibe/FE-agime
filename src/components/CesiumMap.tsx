import { useRef, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Viewer,
  Ion,
  Cartesian3,
  ScreenSpaceEventHandler,
  ScreenSpaceEventType,
  defined,
  Cartographic,
  Math as CesiumMath,
  Color,
  PolygonHierarchy,
  ColorMaterialProperty,
  Entity
} from 'cesium';
import { FarmCreationDialog } from './FarmCreationDialog';
import { Toast } from './ui/toast';

// Set your Cesium Ion access token
Ion.defaultAccessToken = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiI2ZmM0MGZmMi1mM2E2LTQ0MmEtYjE4ZS1jMjFhOGEyYzMzZWUiLCJpZCI6MzM0NDM3LCJpYXQiOjE3NTU4NTkyOTF9.psLMJyO3td3N9F564Pgf5D_-USXQgKAT2vExPjxSpUs";

function CesiumMap() {
  const viewerRef = useRef<HTMLDivElement>(null);
  const cesiumViewerRef = useRef<Viewer | null>(null);
  const navigate = useNavigate();
  const [isLocating, setIsLocating] = useState(false);
  
  // Polygon drawing states
  const [isDrawingMode, setIsDrawingMode] = useState(false);
  const [polygonPoints, setPolygonPoints] = useState<Cartesian3[]>([]);
  const [completedPolygons, setCompletedPolygons] = useState<Array<{points: Cartesian3[], coordinates: Array<{lat: number, lon: number}>}>>([]);
  const pointEntitiesRef = useRef<Entity[]>([]);
  const handlerRef = useRef<ScreenSpaceEventHandler | null>(null);
  
  // Farm creation states
  const [showFarmDialog, setShowFarmDialog] = useState(false);
  const [pendingPolygon, setPendingPolygon] = useState<Array<{lat: number, lon: number}> | null>(null);
  const [showConfirmationPopup, setShowConfirmationPopup] = useState(false);
  const [tempCoordinates, setTempCoordinates] = useState<Array<{lat: number, lon: number}>>([]);
  
  // Analysis states
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [currentFarmName, setCurrentFarmName] = useState('');
  const [showAnalyzeButton, setShowAnalyzeButton] = useState(false);
  const [currentFarmId, setCurrentFarmId] = useState<string>('');
  
  // Toast state
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  // Function to order points to create a simple (non-self-intersecting) polygon
  const orderPointsForSimplePolygon = (points: Cartesian3[]) => {
    if (points.length <= 3) return points;
    
    // Convert to 2D coordinates for easier calculation
    const points2D = points.map(point => {
      const cartographic = Cartographic.fromCartesian(point);
      return {
        x: CesiumMath.toDegrees(cartographic.longitude),
        y: CesiumMath.toDegrees(cartographic.latitude),
        original: point
      };
    });
    
    // Find centroid
    const centroid = {
      x: points2D.reduce((sum, p) => sum + p.x, 0) / points2D.length,
      y: points2D.reduce((sum, p) => sum + p.y, 0) / points2D.length
    };
    
    // Sort points by angle from centroid to create a simple polygon
    const sortedPoints = points2D.sort((a, b) => {
      const angleA = Math.atan2(a.y - centroid.y, a.x - centroid.x);
      const angleB = Math.atan2(b.y - centroid.y, b.x - centroid.x);
      return angleA - angleB;
    });
    
    return sortedPoints.map(p => p.original);
  };
  
  const cartesianToCoordinates = (cartesian: Cartesian3) => {
    const cartographic = Cartographic.fromCartesian(cartesian);
    return {
      lat: CesiumMath.toDegrees(cartographic.latitude),
      lon: CesiumMath.toDegrees(cartographic.longitude)
    };
  };

  // Function to start polygon drawing mode
  const startDrawingPolygon = () => {
    if (!cesiumViewerRef.current) return;
    
    setIsDrawingMode(true);
    setPolygonPoints([]);
    
    // Clear existing point entities
    pointEntitiesRef.current.forEach(entity => {
      cesiumViewerRef.current?.entities.remove(entity);
    });
    pointEntitiesRef.current = [];

    // Create click handler for adding points
    if (handlerRef.current) {
      handlerRef.current.destroy();
    }
    
    handlerRef.current = new ScreenSpaceEventHandler(cesiumViewerRef.current.scene.canvas);
    
    handlerRef.current.setInputAction((click: any) => {
      const viewer = cesiumViewerRef.current;
      if (!viewer) return;

      const pickedPosition = viewer.camera.pickEllipsoid(click.position, viewer.scene.globe.ellipsoid);
      if (!defined(pickedPosition)) return;

      // Add point marker
      const pointEntity = viewer.entities.add({
        position: pickedPosition,
        point: {
          pixelSize: 8,
          color: Color.YELLOW,
          outlineColor: Color.BLACK,
          outlineWidth: 2,
          heightReference: 0
        }
      });
      
      pointEntitiesRef.current.push(pointEntity);

      // Update polygon points
      setPolygonPoints(prev => {
        const newPoints = [...prev, pickedPosition];
        
        // Don't create polygon during drawing - only show points
        // The polygon will be created only when user clicks "Complete"
        
        return newPoints;
      });
    }, ScreenSpaceEventType.LEFT_CLICK);
  };

  // Function to complete current polygon
  const completePolygon = () => {
    if (polygonPoints.length < 3) {
      alert('Please select at least 3 points to complete a polygon');
      return;
    }

    const viewer = cesiumViewerRef.current;
    if (!viewer) return;

    // Order points to prevent self-intersection and overlapping
    const orderedPoints = orderPointsForSimplePolygon(polygonPoints);

    // Create the final filled polygon
    viewer.entities.add({
      polygon: {
        hierarchy: new PolygonHierarchy(orderedPoints),
        // Use ColorMaterialProperty for consistent solid fill
        material: new ColorMaterialProperty(Color.BLUE.withAlpha(0.4)),
        outline: true,
        outlineColor: Color.DARKBLUE,
        outlineWidth: 2,
        height: 0,
        // Critical: Disable all properties that might cause triangulation artifacts
        extrudedHeight: undefined,
        perPositionHeight: false,
        closeTop: false,
        closeBottom: false,
        // Disable shadows and classification that can cause visual artifacts
        shadows: 0,
        classificationType: undefined,
        // Ensure consistent fill
        fill: true,
        show: true
      }
    });

    // Convert points to coordinates
    const coordinates = polygonPoints.map(cartesianToCoordinates);
    
    // Show confirmation popup
    setTempCoordinates(coordinates);
    setShowConfirmationPopup(true);
    
    // Log coordinates to console
    console.log('Polygon completed with coordinates:', coordinates);
    
    // Reset drawing state
    setIsDrawingMode(false);
    setPolygonPoints([]);
    
    // Clear point markers (they're no longer needed since we have the filled polygon)
    pointEntitiesRef.current.forEach(entity => {
      viewer.entities.remove(entity);
    });
    pointEntitiesRef.current = [];
    
    // Destroy click handler
    if (handlerRef.current) {
      handlerRef.current.destroy();
      handlerRef.current = null;
    }
  };

  // Function to confirm polygon and open farm creation dialog
  const confirmPolygon = () => {
    // Save completed polygon to state with the actual points
    setCompletedPolygons(prev => [...prev, { 
      points: polygonPoints, // Store the actual Cartesian3 points
      coordinates: tempCoordinates 
    }]);
    
    // Set pending polygon for farm creation
    setPendingPolygon(tempCoordinates);
    
    // Close confirmation popup and open farm dialog
    setShowConfirmationPopup(false);
    setShowFarmDialog(true);
  };

  // Function to cancel polygon confirmation
  const cancelPolygonConfirmation = () => {
    const viewer = cesiumViewerRef.current;
    if (!viewer) return;
    
    // Remove the last added polygon entity
    const entities = viewer.entities.values;
    if (entities.length > 0) {
      const lastEntity = entities[entities.length - 1];
      if (lastEntity.polygon) {
        viewer.entities.remove(lastEntity);
      }
    }
    
    // Clear temp coordinates and close popup
    setTempCoordinates([]);
    setShowConfirmationPopup(false);
  };

  // Function to handle successful farm creation
  const handleFarmCreated = async (farm: any) => {
    console.log('Farm created successfully:', farm);
    setPendingPolygon(null);
    setCurrentFarmName(farm.name);
    setCurrentFarmId(farm.id); // Store the farm ID
    
    // Start the new flow: zoom out, rotate, analyze, zoom in
    await startAnalysisFlow(farm);
  };

  // Function to start the complete analysis flow
  const startAnalysisFlow = async (farm: any) => {
    if (!cesiumViewerRef.current) return;
    
    console.log('🎬 [DEBUG] Starting complete analysis flow for farm:', farm);
    console.log('📊 [DEBUG] Current completed polygons:', completedPolygons);
    console.log('📊 [DEBUG] Temp coordinates:', tempCoordinates);
    
    // Step 1: Zoom out to original globe view
    console.log('🌍 [DEBUG] Step 1: Zooming out to original globe view...');
    await zoomToOriginalView();
    
    // Step 2: Start slow globe rotation and analysis
    console.log('🔄 [DEBUG] Step 2: Starting globe rotation and analysis...');
    await startGlobeRotationWithAnalysis(farm.id);
    
    // Step 3: Zoom back in to the farm
    console.log('📍 [DEBUG] Step 3: Zooming back in to farm...');
    await zoomToFarm(farm);
    
    // Step 4: Show analyze button
    console.log('🔍 [DEBUG] Step 4: Showing analyze button...');
    setShowAnalyzeButton(true);
    console.log('✅ [DEBUG] Analysis flow completed - button should be visible now');
  };

  // Function to zoom out to original globe view
  const zoomToOriginalView = (): Promise<void> => {
    return new Promise((resolve) => {
      if (!cesiumViewerRef.current) {
        resolve();
        return;
      }
      
      const viewer = cesiumViewerRef.current;
      
      // Fly to a default view (similar to initial load)
      viewer.camera.flyTo({
        destination: Cartesian3.fromDegrees(0, 0, 20000000), // Default view
        duration: 2.0,
        complete: () => {
          console.log('✅ [DEBUG] Zoomed out to original view');
          resolve();
        }
      });
    });
  };

  // Function to start globe rotation with analysis
  const startGlobeRotationWithAnalysis = async (farmId: string): Promise<void> => {
    if (!cesiumViewerRef.current) return;
    
    const viewer = cesiumViewerRef.current;
    console.log('🔄 [DEBUG] Starting rotation and analysis for farm ID:', farmId);
    
    // Start slow rotation
    const startTime = Date.now();
    const rotationDuration = 8000; // 8 seconds of rotation
    
    const rotateGlobe = () => {
      const elapsed = Date.now() - startTime;
      
      if (elapsed < rotationDuration && viewer && viewer.camera) {
        // Slow rotation around the globe - rotate around the Z axis
        const currentPosition = viewer.camera.position.clone();
        const currentHeading = viewer.camera.heading;
        
        // Set new heading for rotation
        viewer.camera.setView({
          destination: currentPosition,
          orientation: {
            heading: currentHeading + 0.02,
            pitch: viewer.camera.pitch,
            roll: viewer.camera.roll
          }
        });
        
        requestAnimationFrame(rotateGlobe);
      }
    };
    
    // Start rotation
    rotateGlobe();
    
    // Simulate analysis time (you can replace this with actual API call)
    console.log('🔍 [DEBUG] Starting analysis simulation...');
    await new Promise(resolve => setTimeout(resolve, rotationDuration)); // Wait for rotation to complete
    
    console.log('✅ [DEBUG] Analysis simulation completed');
  };

  // Function to zoom back in to the farm
  const zoomToFarm = (farmData: any): Promise<void> => {
    return new Promise((resolve) => {
      if (!cesiumViewerRef.current) {
        resolve();
        return;
      }
      
      const viewer = cesiumViewerRef.current;
      
      // Use the farm centroid if available, otherwise calculate from coordinates
      let centerLat, centerLon;
      
      if (farmData.centroid) {
        centerLat = farmData.centroid.lat;
        centerLon = farmData.centroid.lon;
      } else {
        // Calculate center from tempCoordinates (the coordinates we just used to create the farm)
        if (tempCoordinates.length > 0) {
          centerLat = tempCoordinates.reduce((sum, coord) => sum + coord.lat, 0) / tempCoordinates.length;
          centerLon = tempCoordinates.reduce((sum, coord) => sum + coord.lon, 0) / tempCoordinates.length;
        } else {
          console.error('❌ [DEBUG] No coordinates available for zoom');
          resolve();
          return;
        }
      }
      
      console.log('📍 [DEBUG] Zooming to coordinates:', { lat: centerLat, lon: centerLon });
      
      // Fly to the farm location
      viewer.camera.flyTo({
        destination: Cartesian3.fromDegrees(centerLon, centerLat, 5000), // 5km altitude
        duration: 2.0,
        complete: () => {
          console.log('✅ [DEBUG] Zoomed in to farm location');
          resolve();
        }
      });
    });
  };

  // Function to handle analyze button click
  const handleAnalyzeClick = async () => {
    if (!currentFarmId) return;
    
    setIsAnalyzing(true);
    setShowAnalyzeButton(false);
    
    try {
      console.log('🚀 [DEBUG] Starting farm analysis...');
      console.log('📋 [DEBUG] Farm name:', currentFarmName);
      console.log('🌐 [DEBUG] Redirecting to dashboard...');
      
      // Redirect to dashboard with farm data
      navigate('/', { 
        state: { 
          farmName: currentFarmName,
          farmId: currentFarmId,
          coordinates: completedPolygons[completedPolygons.length - 1]?.coordinates || [],
          showAnalysis: true // Flag to show analysis data on dashboard
        } 
      });
      
    } catch (error: any) {
      console.error('❌ [DEBUG] Error during analysis setup:', error);
      setToast({
        message: 'Failed to start analysis',
        type: 'error'
      });
      setIsAnalyzing(false);
      setShowAnalyzeButton(true);
    }
  };

  // Function to handle farm creation errors
  const handleFarmError = (error: string) => {
    setToast({
      message: error,
      type: 'error'
    });
  };

  // Function to cancel current polygon drawing
  const cancelDrawing = () => {
    if (!cesiumViewerRef.current) return;
    
    setIsDrawingMode(false);
    setPolygonPoints([]);
    
    // Clear point markers
    pointEntitiesRef.current.forEach(entity => {
      cesiumViewerRef.current?.entities.remove(entity);
    });
    pointEntitiesRef.current = [];
    
    // Destroy click handler
    if (handlerRef.current) {
      handlerRef.current.destroy();
      handlerRef.current = null;
    }
  };

  // Function to clear all polygons
  const clearAllPolygons = () => {
    if (!cesiumViewerRef.current) return;
    
    // Clear all entities
    cesiumViewerRef.current.entities.removeAll();
    
    // Reset states
    setCompletedPolygons([]);
    setPolygonPoints([]);
    pointEntitiesRef.current = [];
    
    // Reset analysis states
    setShowAnalyzeButton(false);
    setIsAnalyzing(false);
    setCurrentFarmName('');
    setCurrentFarmId('');
    
    // Cancel any ongoing drawing
    if (isDrawingMode) {
      cancelDrawing();
    }
  };

  // Function to zoom to current location
  const zoomToCurrentLocation = () => {
    if (!cesiumViewerRef.current) return;

    setIsLocating(true);
    
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          
          // Convert to Cesium coordinates and zoom to location (closer zoom - 1km altitude)
          const destination = Cartesian3.fromDegrees(longitude, latitude, 1000); // 1km altitude for closer view
          
          cesiumViewerRef.current?.camera.flyTo({
            destination: destination,
            duration: 2.0 // 2 second animation
          });
          
          setIsLocating(false);
        },
        (error) => {
          console.error('Error getting location:', error);
          alert('Unable to get your location. Please make sure location services are enabled.');
          setIsLocating(false);
        },
        {
          enableHighAccuracy: true,
          timeout: 15000, // Increased timeout for better accuracy
          maximumAge: 30000 // Reduced max age for fresher location data
        }
      );
    } else {
      alert('Geolocation is not supported by this browser.');
      setIsLocating(false);
    }
  };

  useEffect(() => {
    if (viewerRef.current && !cesiumViewerRef.current) {
      cesiumViewerRef.current = new Viewer(viewerRef.current, {
        terrainProvider: undefined, // You can add Cesium World Terrain later
        // Disable bottom bar (timeline and animation controls)
        timeline: false,
        // Disable animation widget
        animation: false,
        // Disable bottom bar completely
        shouldAnimate: false,
        // Disable top right icons (geocoder, home button, scene mode picker, etc.)
        geocoder: false,
        homeButton: false,
        sceneModePicker: false,
        baseLayerPicker: false,
        navigationHelpButton: false,
        fullscreenButton: false,
        vrButton: false,
        // Disable info box
        infoBox: false,
        // Disable selection indicator
        selectionIndicator: false,
        // Disable credit container (watermark)
        creditContainer: undefined,
      });
    }

    return () => {
      // Clean up event handler
      if (handlerRef.current) {
        handlerRef.current.destroy();
        handlerRef.current = null;
      }
      
      if (cesiumViewerRef.current) {
        cesiumViewerRef.current.destroy();
        cesiumViewerRef.current = null;
      }
    };
  }, []);

  return (
    <div style={{ 
      width: "100vw", 
      height: "100vh", 
      position: "relative",
      margin: 0,
      padding: 0,
      overflow: "hidden"
    }} ref={viewerRef}>
      {/* Location Button */}
      <div style={{
        position: "absolute",
        top: "10px",
        right: "10px",
        zIndex: 100,
        padding: "10px"
      }}>
        <button 
          onClick={zoomToCurrentLocation}
          disabled={isLocating}
          style={{
            backgroundColor: "#0078D7",
            color: "white",
            border: "none",
            padding: "10px 16px",
            borderRadius: "6px",
            cursor: isLocating ? "not-allowed" : "pointer",
            fontSize: "14px",
            fontWeight: "500",
            boxShadow: "0 2px 4px rgba(0,0,0,0.2)",
            opacity: isLocating ? 0.7 : 1,
            transition: "all 0.2s ease"
          }}
        >
          {isLocating ? "Locating..." : "📍 My Location"}
        </button>
      </div>

      {/* Polygon Drawing Controls */}
      <div style={{
        position: "absolute",
        top: "10px",
        left: "10px",
        zIndex: 100,
        padding: "10px",
        display: "flex",
        flexDirection: "column",
        gap: "8px"
      }}>
        {!isDrawingMode ? (
          <button 
            onClick={startDrawingPolygon}
            style={{
              backgroundColor: "#28a745",
              color: "white",
              border: "none",
              padding: "10px 16px",
              borderRadius: "6px",
              cursor: "pointer",
              fontSize: "14px",
              fontWeight: "500",
              boxShadow: "0 2px 4px rgba(0,0,0,0.2)",
              transition: "all 0.2s ease"
            }}
          >
            🗺️ Draw Polygon
          </button>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            <div style={{
              backgroundColor: "rgba(0,0,0,0.8)",
              color: "white",
              padding: "8px 12px",
              borderRadius: "4px",
              fontSize: "12px",
              textAlign: "center"
            }}>
              Click points to mark vertices
              <br />
              Points: {polygonPoints.length}
              <br />
              <small>Polygon will appear when completed</small>
            </div>
            
            <button 
              onClick={completePolygon}
              disabled={polygonPoints.length < 3}
              style={{
                backgroundColor: polygonPoints.length >= 3 ? "#007bff" : "#6c757d",
                color: "white",
                border: "none",
                padding: "8px 12px",
                borderRadius: "4px",
                cursor: polygonPoints.length >= 3 ? "pointer" : "not-allowed",
                fontSize: "12px",
                fontWeight: "500",
                boxShadow: "0 2px 4px rgba(0,0,0,0.2)"
              }}
            >
              ✅ Complete
            </button>
            
            <button 
              onClick={cancelDrawing}
              style={{
                backgroundColor: "#dc3545",
                color: "white",
                border: "none",
                padding: "8px 12px",
                borderRadius: "4px",
                cursor: "pointer",
                fontSize: "12px",
                fontWeight: "500",
                boxShadow: "0 2px 4px rgba(0,0,0,0.2)"
              }}
            >
              ❌ Cancel
            </button>
          </div>
        )}

        {completedPolygons.length > 0 && (
          <button 
            onClick={clearAllPolygons}
            style={{
              backgroundColor: "#ffc107",
              color: "#212529",
              border: "none",
              padding: "8px 12px",
              borderRadius: "4px",
              cursor: "pointer",
              fontSize: "12px",
              fontWeight: "500",
              boxShadow: "0 2px 4px rgba(0,0,0,0.2)",
              marginTop: "8px"
            }}
          >
            🗑️ Clear All ({completedPolygons.length})
          </button>
        )}

        {/* Analyze Button */}
        {showAnalyzeButton && (
          <button 
            onClick={handleAnalyzeClick}
            disabled={isAnalyzing}
            style={{
              backgroundColor: "#28a745",
              color: "white",
              border: "none",
              padding: "12px 20px",
              borderRadius: "8px",
              cursor: isAnalyzing ? "not-allowed" : "pointer",
              fontSize: "16px",
              fontWeight: "600",
              boxShadow: "0 4px 12px rgba(40, 167, 69, 0.3)",
              marginTop: "12px",
              opacity: isAnalyzing ? 0.7 : 1,
              transition: "all 0.3s ease",
              animation: "pulse 2s infinite"
            }}
          >
            {isAnalyzing ? "🔄 Analyzing..." : "🔍 Analyze Farm"}
          </button>
        )}
      </div>

      {/* Coordinates Display */}
      {completedPolygons.length > 0 && (
        <div style={{
          position: "absolute",
          bottom: "10px",
          left: "10px",
          zIndex: 100,
          backgroundColor: "rgba(0,0,0,0.8)",
          color: "white",
          padding: "10px",
          borderRadius: "6px",
          maxWidth: "300px",
          maxHeight: "200px",
          overflow: "auto",
          fontSize: "12px"
        }}>
          <h4 style={{ margin: "0 0 8px 0" }}>Polygon Coordinates:</h4>
          {completedPolygons.map((polygon, polygonIndex) => (
            <div key={polygonIndex} style={{ marginBottom: "8px" }}>
              <strong>Polygon {polygonIndex + 1}:</strong>
              {polygon.coordinates.map((coord, pointIndex) => (
                <div key={pointIndex} style={{ marginLeft: "8px" }}>
                  Point {pointIndex + 1}: {coord.lat.toFixed(6)}, {coord.lon.toFixed(6)}
                </div>
              ))}
            </div>
          ))}
        </div>
      )}

      {/* Polygon Confirmation Popup */}
      {showConfirmationPopup && (
        <div style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          zIndex: 1000,
          backgroundColor: "white",
          padding: "20px",
          borderRadius: "8px",
          boxShadow: "0 4px 20px rgba(0,0,0,0.3)",
          maxWidth: "400px",
          width: "90%"
        }}>
          <h3 style={{ margin: "0 0 12px 0", color: "#333" }}>Confirm Farm Boundary</h3>
          <p style={{ margin: "0 0 16px 0", color: "#666", fontSize: "14px" }}>
            You've drawn a farm boundary with {tempCoordinates.length} points. 
            Would you like to create a farm with this boundary?
          </p>
          <div style={{
            display: "flex",
            gap: "12px",
            justifyContent: "flex-end"
          }}>
            <button
              onClick={cancelPolygonConfirmation}
              style={{
                backgroundColor: "#6c757d",
                color: "white",
                border: "none",
                padding: "8px 16px",
                borderRadius: "4px",
                cursor: "pointer",
                fontSize: "14px",
                fontWeight: "500"
              }}
            >
              Cancel
            </button>
            <button
              onClick={confirmPolygon}
              style={{
                backgroundColor: "#007bff",
                color: "white",
                border: "none",
                padding: "8px 16px",
                borderRadius: "4px",
                cursor: "pointer",
                fontSize: "14px",
                fontWeight: "500"
              }}
            >
              Create Farm
            </button>
          </div>
        </div>
      )}

      {/* Farm Creation Dialog */}
      {pendingPolygon && (
        <FarmCreationDialog
          open={showFarmDialog}
          onOpenChange={setShowFarmDialog}
          coordinates={pendingPolygon}
          onFarmCreated={handleFarmCreated}
          onError={handleFarmError}
        />
      )}

      {/* Toast Notifications */}
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}

      {/* CSS Animations */}
      <style>{`
        @keyframes pulse {
          0%, 100% { 
            transform: scale(1);
            box-shadow: 0 4px 12px rgba(40, 167, 69, 0.3);
          }
          50% { 
            transform: scale(1.05);
            box-shadow: 0 6px 20px rgba(40, 167, 69, 0.5);
          }
        }
      `}</style>
    </div>
  );
}

export default CesiumMap;
