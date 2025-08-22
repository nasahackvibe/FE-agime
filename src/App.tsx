import { useEffect, useRef, useState } from "react";
import { 
  Ion, 
  Viewer, 
  Entity, 
  Cartesian3, 
  PolygonHierarchy, 
  ScreenSpaceEventHandler, 
  ScreenSpaceEventType, 
  Color, 
  CallbackProperty,
  Cartesian2
} from "cesium";

function App() {
  // Your access token
  Ion.defaultAccessToken = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiI2ZmM0MGZmMi1mM2E2LTQ0MmEtYjE4ZS1jMjFhOGEyYzMzZWUiLCJpZCI6MzM0NDM3LCJpYXQiOjE3NTU4NTkyOTF9.psLMJyO3td3N9F564Pgf5D_-USXQgKAT2vExPjxSpUs";
  const viewerRef = useRef<HTMLDivElement>(null);
  const cesiumViewerRef = useRef<Viewer | null>(null);
  const eventHandlerRef = useRef<ScreenSpaceEventHandler | null>(null);
  const polygonEntityRef = useRef<Entity | null>(null);
  const [coordinates, setCoordinates] = useState<Cartesian3[]>([]);
  const [isDrawing, setIsDrawing] = useState(false);

  // Convert Cartesian3 to degrees
  const cartesianToDegrees = (cartesian: Cartesian3) => {
    const cartographic = viewerRef.current ? 
      cesiumViewerRef.current?.scene.globe.ellipsoid.cartesianToCartographic(cartesian) : 
      null;
    if (cartographic) {
      return {
        longitude: (cartographic.longitude * 180) / Math.PI,
        latitude: (cartographic.latitude * 180) / Math.PI,
        height: cartographic.height
      };
    }
    return null;
  };

  // Start drawing a new polygon
  const startDrawing = (e: React.MouseEvent) => {
    e.preventDefault(); // Prevent form submission/refresh
    if (cesiumViewerRef.current) {
      // Clear existing polygon
      if (polygonEntityRef.current) {
        cesiumViewerRef.current.entities.remove(polygonEntityRef.current);
      }
      
      setCoordinates([]);
      setIsDrawing(true);
    }
  };

  // Finish drawing and display coordinates
  const finishDrawing = (e: React.MouseEvent) => {
    e.preventDefault(); // Prevent form submission/refresh
    setIsDrawing(false);
    console.log("Polygon coordinates:", coordinates);
    
    // Display coordinates in console
    const degreesArray = coordinates.map(cartesian => cartesianToDegrees(cartesian));
    console.log("Polygon coordinates (degrees):", degreesArray);
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

      // Add event handlers for drawing
      eventHandlerRef.current = new ScreenSpaceEventHandler(viewerRef.current);
      
      // Left click to add points
      eventHandlerRef.current.setInputAction((click: { position: Cartesian2 }) => {
        if (!cesiumViewerRef.current || !isDrawing) return;
        
        const cartesian = cesiumViewerRef.current.camera.pickEllipsoid(
          click.position, 
          cesiumViewerRef.current.scene.globe.ellipsoid
        );
        
        if (cartesian) {
          setCoordinates(prev => [...prev, cartesian]);
          
          // Create or update polygon
          if (!polygonEntityRef.current) {
            polygonEntityRef.current = cesiumViewerRef.current.entities.add({
              name: "Drawing Polygon",
              polygon: {
                hierarchy: new CallbackProperty(() => {
                  return new PolygonHierarchy(coordinates);
                }, false),
                material: Color.RED.withAlpha(0.5),
                outline: true,
                outlineColor: Color.RED,
              }
            });
          }
        }
      }, ScreenSpaceEventType.LEFT_CLICK);
      
      // Right click to finish drawing
      eventHandlerRef.current.setInputAction(() => {
        if (isDrawing && coordinates.length > 2) {
          finishDrawing(new MouseEvent('click') as any);
        }
      }, ScreenSpaceEventType.RIGHT_CLICK);
    }

    return () => {
      if (cesiumViewerRef.current) {
        cesiumViewerRef.current.destroy();
        cesiumViewerRef.current = null;
      }
      if (eventHandlerRef.current) {
        eventHandlerRef.current.destroy();
        eventHandlerRef.current = null;
      }
    };
  }, [isDrawing, coordinates]);

  return (
    <div style={{ width: "100vw", height: "100vh", position: "relative" }} ref={viewerRef}>
      <div style={{
        position: "absolute",
        top: "10px",
        left: "10px",
        zIndex: 100,
        padding: "10px",
        backgroundColor: "rgba(42, 42, 42, 0.8)",
        borderRadius: "5px",
        color: "white"
      }}>
        <button 
          onClick={startDrawing}
          style={{
            backgroundColor: "#0078D7",
            color: "white",
            border: "none",
            padding: "8px 16px",
            borderRadius: "4px",
            cursor: "pointer",
            marginRight: "10px"
          }}
        >
          Start Drawing
        </button>
        <button 
          onClick={finishDrawing}
          disabled={!isDrawing || coordinates.length < 3}
          style={{
            backgroundColor: isDrawing && coordinates.length >= 3 ? "#0078D7" : "#555",
            color: "white",
            border: "none",
            padding: "8px 16px",
            borderRadius: "4px",
            cursor: isDrawing && coordinates.length >= 3 ? "pointer" : "not-allowed"
          }}
        >
          Finish Drawing
        </button>
        <div style={{ marginTop: "10px", fontSize: "12px" }}>
          Points: {coordinates.length}
        </div>
      </div>
      
      {/* Display coordinates when available */}
      {coordinates.length > 0 && (
        <div style={{
          position: "absolute",
          bottom: "10px",
          left: "10px",
          zIndex: 100,
          padding: "10px",
          backgroundColor: "rgba(42, 42, 42, 0.8)",
          borderRadius: "5px",
          color: "white",
          maxHeight: "150px",
          overflowY: "auto",
          fontSize: "12px"
        }}>
          <div>Coordinates (degrees):</div>
          {coordinates.map((coord, index) => {
            const degrees = cartesianToDegrees(coord);
            return degrees ? (
              <div key={index}>
                Point {index + 1}: {degrees.longitude.toFixed(6)}, {degrees.latitude.toFixed(6)}
              </div>
            ) : null;
          })}
        </div>
      )}
    </div>
  );
}

export default App;
