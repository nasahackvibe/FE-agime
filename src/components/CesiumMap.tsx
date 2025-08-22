import { useRef, useEffect, useState } from 'react';
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

// Set your Cesium Ion access token
Ion.defaultAccessToken = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiI2ZmM0MGZmMi1mM2E2LTQ0MmEtYjE4ZS1jMjFhOGEyYzMzZWUiLCJpZCI6MzM0NDM3LCJpYXQiOjE3NTU4NTkyOTF9.psLMJyO3td3N9F564Pgf5D_-USXQgKAT2vExPjxSpUs";

function CesiumMap() {
  const viewerRef = useRef<HTMLDivElement>(null);
  const cesiumViewerRef = useRef<Viewer | null>(null);
  const [isLocating, setIsLocating] = useState(false);
  
  // Polygon drawing states
  const [isDrawingMode, setIsDrawingMode] = useState(false);
  const [polygonPoints, setPolygonPoints] = useState<Cartesian3[]>([]);
  const [completedPolygons, setCompletedPolygons] = useState<Array<{points: Cartesian3[], coordinates: Array<{lat: number, lon: number}>}>>([]);
  const [currentPolygonEntity, setCurrentPolygonEntity] = useState<Entity | null>(null);
  const pointEntitiesRef = useRef<Entity[]>([]);
  const handlerRef = useRef<ScreenSpaceEventHandler | null>(null);

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
    
    // No need to remove polygon entity since we don't create them during drawing
    setCurrentPolygonEntity(null);

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
    const polygonEntity = viewer.entities.add({
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
    
    // Save completed polygon
    setCompletedPolygons(prev => [...prev, { points: polygonPoints, coordinates }]);
    
    // Log coordinates to console
    console.log('Polygon completed with coordinates:', coordinates);
    
    // Reset drawing state
    setIsDrawingMode(false);
    setPolygonPoints([]);
    setCurrentPolygonEntity(null);
    
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

  // Function to cancel current polygon drawing
  const cancelDrawing = () => {
    if (!cesiumViewerRef.current) return;
    
    setIsDrawingMode(false);
    setPolygonPoints([]);
    
    // Since we don't create polygons during drawing, no need to remove currentPolygonEntity
    setCurrentPolygonEntity(null);
    
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
    setCurrentPolygonEntity(null);
    pointEntitiesRef.current = [];
    
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
    </div>
  );
}

export default CesiumMap;
