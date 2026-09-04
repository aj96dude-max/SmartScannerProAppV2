import React, { useRef, useState, useEffect, useCallback } from 'react';
import { StatusBar, StyleSheet, View, Text, TouchableOpacity, Alert, ActivityIndicator, Image, ScrollView } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { Cropper } from './Cropper';
import { Camera, useCameraDevice, useCameraPermission, useFrameProcessor } from 'react-native-vision-camera';
import { Worklets } from 'react-native-worklets-core';
import Svg, { Polygon } from 'react-native-svg';
import { SmartScanner, detectDocumentEdgesLive as detectEdgesPlugin } from './src/SmartScanner';


type AppState = 'CAMERA' | 'CAPTURED' | 'CROPPED' | 'FILTERED' | 'NOHAND';

function App() {
  const { hasPermission, requestPermission } = useCameraPermission();
  const device = useCameraDevice('back');
  const camera = useRef<Camera>(null);

  const [appState, setAppState] = useState<AppState>('CAMERA');
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentImage, setCurrentImage] = useState<string | null>(null);
  const [imageSize, setImageSize] = useState<{width: number, height: number} | null>(null);

  // Store detected edges
  const [detectedEdges, setDetectedEdges] = useState<any>(null);
  const [liveEdges, setLiveEdges] = useState<any>(null);

  const [viewSize, setViewSize] = useState({width: 0, height: 0});

  const updateLiveEdgesJS = useCallback(Worklets.createRunOnJS(setLiveEdges), []);

  const frameProcessor = useFrameProcessor((frame) => {
    'worklet';
    if (detectEdgesPlugin == null || viewSize.width === 0) {return;}
    const result = detectEdgesPlugin.call(frame) as any;
    if (result && result.found) {
      const fw = frame.width;
      const fh = frame.height;
      const vw = viewSize.width;
      const vh = viewSize.height;

      // Camera frames are usually landscape (fw > fh). If screen is portrait (vw < vh), rotate 90deg CW.
      let rw = fw;
      let rh = fh;
      let rotate = false;
      if (fw > fh && vw < vh) {
        rw = fh;
        rh = fw;
        rotate = true;
      }

      // VisionCamera default resizeMode="cover" logic
      const scale = Math.max(vw / rw, vh / rh);
      const scaledW = rw * scale;
      const scaledH = rh * scale;
      const offsetX = (scaledW - vw) / 2;
      const offsetY = (scaledH - vh) / 2;

      const mapPoint = (x: number, y: number) => {
        'worklet';
        let rx = x;
        let ry = y;
        if (rotate) {
          rx = fh - y; // 90deg CW rotation
          ry = x;
        }
        return {
          x: rx * scale - offsetX,
          y: ry * scale - offsetY
        };
      };

      const mappedResult = {
        found: true,
        tl: mapPoint(result.tl.x, result.tl.y),
        tr: mapPoint(result.tr.x, result.tr.y),
        br: mapPoint(result.br.x, result.br.y),
        bl: mapPoint(result.bl.x, result.bl.y),
      };
      updateLiveEdgesJS(mappedResult);
    } else {
      updateLiveEdgesJS(null);
    }
  }, [viewSize, updateLiveEdgesJS]);

  useEffect(() => {
    if (!hasPermission) {requestPermission();}
  }, [hasPermission, requestPermission]);

  const capturePhoto = async () => {
    if (!camera.current) {return;}
    try {
      setIsProcessing(true);
      const photo = await camera.current.takePhoto({ flash: 'off' });
      const path = photo.path;
      setCurrentImage(path);
      setImageSize({ width: photo.width, height: photo.height });

      // Auto-detect edges on capture
      const edges = SmartScanner.detectEdges(path);
      if (edges && edges.found) {
        setDetectedEdges(edges);
        Alert.alert('Edges Detected!', 'Document successfully found in image.');
      } else {
        Alert.alert('No Edges Found', 'Could not detect a clear document in this photo.');
      }
      setAppState('CAPTURED');
    } catch (e: any) {
      Alert.alert('Capture Error', e.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleAutoCrop = () => {
    if (!currentImage || !detectedEdges || !detectedEdges.found) {return;}
    setIsProcessing(true);
    setTimeout(() => {
      try {
        const resultPath = SmartScanner.crop(currentImage, detectedEdges);
        if (resultPath) {
          setCurrentImage(resultPath);
          setAppState('CROPPED');
        } else {
          Alert.alert('Crop Failed', 'Native C++ engine failed to crop.');
        }
      } finally {
        setIsProcessing(false);
      }
    }, 100);
  };

  const handleFilter = (type: 'lightened' | 'magic_color' | 'bw') => {
    if (!currentImage) {return;}
    setIsProcessing(true);
    setTimeout(() => {
      try {
        const resultPath = SmartScanner.applyFilter(currentImage, type);
        if (resultPath) {
          setCurrentImage(resultPath);
          setAppState('FILTERED');
        } else {
          Alert.alert('Filter Failed', 'Native C++ engine failed to apply filter.');
        }
      } finally {
        setIsProcessing(false);
      }
    }, 100);
  };

  const handleRemoveHand = () => {
    if (!currentImage) {return;}
    setIsProcessing(true);
    setTimeout(() => {
      try {
        const resultPath = SmartScanner.removeHand(currentImage);
        if (resultPath) {
          setCurrentImage(resultPath);
          setAppState('NOHAND');
          Alert.alert('Success', 'Hand heuristic and inpainting applied.');
        } else {
          Alert.alert('Remove Hand Failed', 'Native C++ engine failed.');
        }
      } finally {
        setIsProcessing(false);
      }
    }, 100);
  };

  const resetCamera = () => {
    setCurrentImage(null);
    setImageSize(null);
    setDetectedEdges(null);
    setAppState('CAMERA');
  };

  if (!hasPermission) {return <View style={styles.center}><Text>Requesting Permission...</Text></View>;}
  if (!device) {return <View style={styles.center}><Text>No Camera Found</Text></View>;}

  return (
    <GestureHandlerRootView style={styles.container}>
      <View style={styles.container}>
        <StatusBar barStyle={'light-content'} />

      {appState === 'CAMERA' ? (
        <>
          <Camera
            ref={camera}
            style={StyleSheet.absoluteFill}
            device={device}
            isActive={true}
            photo={true}
            frameProcessor={frameProcessor}
            pixelFormat="yuv"
            onLayout={(e) => setViewSize({width: e.nativeEvent.layout.width, height: e.nativeEvent.layout.height})}
          />
          {liveEdges && liveEdges.found && (
            <View style={StyleSheet.absoluteFill} pointerEvents="none">
              <Svg style={StyleSheet.absoluteFill}>
                <Polygon
                  points={`${liveEdges.tl.x},${liveEdges.tl.y} ${liveEdges.tr.x},${liveEdges.tr.y} ${liveEdges.br.x},${liveEdges.br.y} ${liveEdges.bl.x},${liveEdges.bl.y}`}
                  fill="rgba(0, 255, 0, 0.15)"
                  stroke="#00FF00"
                  strokeWidth="5"
                />
              </Svg>
            </View>
          )}
          <View style={styles.captureOverlay}>
            <TouchableOpacity style={styles.captureButton} onPress={capturePhoto} disabled={isProcessing}>
              <View style={styles.captureButtonInner} />
            </TouchableOpacity>
          </View>
        </>
      ) : (
        <View style={styles.previewContainer}>
          {currentImage && (
            <View style={styles.previewImageWrapper}>
              <Image
                source={{ uri: 'file://' + currentImage }}
                style={StyleSheet.absoluteFill}
                resizeMode="contain"
              />
              {appState === 'CAPTURED' && detectedEdges?.found && imageSize && (
                <Cropper
                  imageWidth={imageSize.width}
                  imageHeight={imageSize.height}
                  initialEdges={detectedEdges}
                  onCornersUpdate={(corners) => {
                    setDetectedEdges({ ...detectedEdges, ...corners });
                  }}
                />
              )}
            </View>
          )}

          <ScrollView style={styles.controlsScroll} contentContainerStyle={styles.controlsContainer}>

            {appState === 'CAPTURED' && detectedEdges?.found && (
              <TouchableOpacity style={styles.actionBtn} onPress={handleAutoCrop}>
                <Text style={styles.actionBtnText}>Auto Crop Document</Text>
              </TouchableOpacity>
            )}

            {(appState === 'CROPPED' || appState === 'FILTERED' || appState === 'NOHAND') && (
              <>
                <Text style={styles.sectionTitle}>Enhance Options</Text>
                <View style={styles.row}>
                  <TouchableOpacity style={[styles.actionBtn, styles.flexBtn]} onPress={() => handleFilter('lightened')}>
                    <Text style={styles.actionBtnText}>Lighten</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.actionBtn, styles.flexBtn, {backgroundColor: '#34C759'}]} onPress={() => handleFilter('magic_color')}>
                    <Text style={styles.actionBtnText}>Magic Color</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.actionBtn, styles.flexBtn, {backgroundColor: '#666'}]} onPress={() => handleFilter('bw')}>
                    <Text style={styles.actionBtnText}>B & W</Text>
                  </TouchableOpacity>
                </View>

                <Text style={styles.sectionTitle}>AI Tools</Text>
                <TouchableOpacity style={[styles.actionBtn, {backgroundColor: '#FF3B30'}]} onPress={handleRemoveHand}>
                  <Text style={styles.actionBtnText}>Remove Hand / Finger</Text>
                </TouchableOpacity>
              </>
            )}

            <TouchableOpacity style={[styles.actionBtn, {backgroundColor: 'transparent', borderWidth: 1, borderColor: '#FFF', marginTop: 30}]} onPress={resetCamera}>
              <Text style={styles.actionBtnText}>Retake Photo</Text>
            </TouchableOpacity>

          </ScrollView>
        </View>
      )}

      {isProcessing && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#FFF" />
          <Text style={{color: '#FFF', marginTop: 10}}>Processing C++ Engine...</Text>
        </View>
      )}
      </View>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#FFF' },
  captureOverlay: { position: 'absolute', bottom: 40, width: '100%', alignItems: 'center' },
  captureButton: { width: 80, height: 80, borderRadius: 40, backgroundColor: 'rgba(255,255,255,0.3)', justifyContent: 'center', alignItems: 'center' },
  captureButtonInner: { width: 64, height: 64, borderRadius: 32, backgroundColor: '#FFF' },
  previewContainer: { flex: 1, paddingTop: 40 },
  previewImageWrapper: { width: '100%', height: '50%', backgroundColor: '#222' },
  controlsScroll: { flex: 1, width: '100%' },
  controlsContainer: { padding: 20 },
  row: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 15 },
  flexBtn: { flex: 0.31, paddingVertical: 12, paddingHorizontal: 5 },
  sectionTitle: { color: '#AAA', fontSize: 14, marginTop: 20, marginBottom: 10, textTransform: 'uppercase', fontWeight: 'bold' },
  actionBtn: { backgroundColor: '#007AFF', padding: 15, borderRadius: 8, alignItems: 'center', marginBottom: 10 },
  actionBtnText: { color: '#FFF', fontWeight: 'bold', fontSize: 14 },
  loadingOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center', zIndex: 1000 },
});

export default App;
