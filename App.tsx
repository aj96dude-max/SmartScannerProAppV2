import React, { useRef, useState, useEffect, useCallback } from 'react';
import { StatusBar, StyleSheet, View, Text, TouchableOpacity, Alert, Image, ScrollView, ActivityIndicator } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { Cropper } from './Cropper';
import { Camera, useCameraDevice, useCameraPermission, useFrameProcessor } from 'react-native-vision-camera';
import { Worklets } from 'react-native-worklets-core';
import Svg, { Polygon } from 'react-native-svg';
import { SmartScanner, detectDocumentEdgesLive as detectEdgesPlugin } from './src/SmartScanner';

import { CameraRoll } from '@react-native-camera-roll/camera-roll';
import { launchImageLibrary } from 'react-native-image-picker';

type AppState = 'CAMERA' | 'CAPTURED' | 'CROPPED' | 'FILTERED';

export default function App() {
  const { hasPermission, requestPermission } = useCameraPermission();
  const device = useCameraDevice('back');
  const camera = useRef<Camera>(null);

  const [appState, setAppState] = useState<AppState>('CAMERA');
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentImage, setCurrentImage] = useState<string | null>(null);
  const [imageSize, setImageSize] = useState<{width: number, height: number} | null>(null);

  const [detectedEdges, setDetectedEdges] = useState<any>(null);
  const [liveEdges, setLiveEdges] = useState<any>(null);
  const [viewSize, setViewSize] = useState({width: 0, height: 0});
  
  const lastEdgesRef = useRef<any>(null);

  useEffect(() => {
    if (!hasPermission) requestPermission();
  }, [hasPermission, requestPermission]);

  const handleEdgesUpdate = (newEdges: any) => {
    if (!newEdges) {
      setLiveEdges(null);
      lastEdgesRef.current = null;
      return;
    }
    
    if (!lastEdgesRef.current) {
      lastEdgesRef.current = newEdges;
      setLiveEdges(newEdges);
      return;
    }

    const ALPHA = 0.25; // Smoothing factor to eliminate jitter
    const smoothPoint = (oldP: any, newP: any) => ({
      x: oldP.x * (1 - ALPHA) + newP.x * ALPHA,
      y: oldP.y * (1 - ALPHA) + newP.y * ALPHA,
    });

    const smoothed = {
      found: true,
      tl: smoothPoint(lastEdgesRef.current.tl, newEdges.tl),
      tr: smoothPoint(lastEdgesRef.current.tr, newEdges.tr),
      br: smoothPoint(lastEdgesRef.current.br, newEdges.br),
      bl: smoothPoint(lastEdgesRef.current.bl, newEdges.bl),
    };
    
    lastEdgesRef.current = smoothed;
    setLiveEdges(smoothed);
  };

  const updateLiveEdgesJS = useCallback(Worklets.createRunOnJS(handleEdgesUpdate), []);

  const frameProcessor = useFrameProcessor((frame) => {
    'worklet';
    if (detectEdgesPlugin == null || viewSize.width === 0) return;
    
    // Pass ROI math (matching the 85x65 UI box) to the native plugin
    const result = detectEdgesPlugin.call(frame, { roiWidth: 0.85, roiHeight: 0.65 }) as any;
    
    if (result && result.found) {
      const fw = frame.width;
      const fh = frame.height;
      const vw = viewSize.width;
      const vh = viewSize.height;

      let rw = fw;
      let rh = fh;
      let rotate = false;
      if (fw > fh && vw < vh) {
        rw = fh;
        rh = fw;
        rotate = true;
      }

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
          rx = fh - y; 
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

  const capturePhoto = async () => {
    if (!camera.current) return;
    try {
      setIsProcessing(true);
      const photo = await camera.current.takePhoto({ flash: 'off' });
      const path = photo.path;
      setCurrentImage(path);
      setImageSize({ width: photo.width, height: photo.height });

      // Pass the identical ROI to the static analyzer so it perfectly matches the live feed!
      const edges = SmartScanner.detectEdges(path, 0.85, 0.65);
      
      if (edges && edges.found) {
        setDetectedEdges(edges);
      } else {
        // Fallback to manual bounding box if still somehow fails
        setDetectedEdges({
          found: true,
          tl: { x: 0.2, y: 0.2 },
          tr: { x: 0.8, y: 0.2 },
          br: { x: 0.8, y: 0.8 },
          bl: { x: 0.2, y: 0.8 }
        });
        Alert.alert('No Edges Found', 'Falling back to manual crop box.');
      }
      setAppState('CAPTURED');
    } catch (e: any) {
      Alert.alert('Capture Error', e.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const pickImageFromGallery = async () => {
    try {
      const result = await launchImageLibrary({ mediaType: 'photo' });
      if (result.didCancel || !result.assets || result.assets.length === 0) return;
      
      const asset = result.assets[0];
      if (!asset.uri) return;
      
      setIsProcessing(true);
      
      let path = asset.uri;
      if (path.startsWith('file://')) {
        path = path.substring(7);
      }

      setCurrentImage(path);
      setImageSize({ width: asset.width || 1000, height: asset.height || 1000 });

      // Run static edge detection on full image (100% ROI)
      const edges = SmartScanner.detectEdges(path, 1.0, 1.0);
      
      if (edges && edges.found) {
        setDetectedEdges(edges);
      } else {
        setDetectedEdges({
          found: true,
          tl: { x: 0.2, y: 0.2 },
          tr: { x: 0.8, y: 0.2 },
          br: { x: 0.8, y: 0.8 },
          bl: { x: 0.2, y: 0.8 }
        });
        Alert.alert('No Edges Found', 'Falling back to manual crop box.');
      }
      setAppState('CAPTURED');
    } catch (e: any) {
      Alert.alert('Gallery Error', e.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const exportToGallery = async () => {
    if (!currentImage) return;
    try {
      setIsProcessing(true);
      await CameraRoll.saveAsset('file://' + currentImage, { type: 'photo', album: 'SmartScanner' });
      Alert.alert('Success!', 'Document saved to gallery.');
      resetCamera();
    } catch (e: any) {
      Alert.alert('Save Failed', e.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleManualCrop = () => {
    if (!currentImage || !detectedEdges || !detectedEdges.found) return;
    setIsProcessing(true);
    setTimeout(() => {
      try {
        const resultPath = SmartScanner.crop(currentImage, detectedEdges);
        if (resultPath) {
          setCurrentImage(resultPath);
          setAppState('CROPPED');
        } else {
          Alert.alert('Crop Failed', 'Native engine failed to crop.');
        }
      } finally {
        setIsProcessing(false);
      }
    }, 100);
  };

  const handleFilter = (type: 'lightened' | 'magic_color' | 'bw') => {
    if (!currentImage) return;
    setIsProcessing(true);
    setTimeout(() => {
      try {
        const resultPath = SmartScanner.applyFilter(currentImage, type);
        if (resultPath) {
          setCurrentImage(resultPath);
          setAppState('FILTERED');
        } else {
          Alert.alert('Filter Failed', 'Native engine failed to apply filter.');
        }
      } finally {
        setIsProcessing(false);
      }
    }, 100);
  };

  const resetCamera = () => {
    setCurrentImage(null);
    setImageSize(null);
    setAppState('CAMERA');
    setDetectedEdges(null);
  };

  if (!hasPermission) return <View style={styles.center}><Text>Requesting Permission...</Text></View>;
  if (!device) return <View style={styles.center}><Text>No Camera Found</Text></View>;

  return (
    <GestureHandlerRootView style={styles.container}>
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
          <View style={styles.targetingOverlay} pointerEvents="none">
            <View style={styles.targetingBox} />
            <Text style={styles.targetingText}>Position document within the frame</Text>
          </View>
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
            <TouchableOpacity style={styles.galleryButton} onPress={pickImageFromGallery} disabled={isProcessing}>
              <Text style={styles.galleryButtonText}>📁</Text>
            </TouchableOpacity>
            
            <TouchableOpacity style={styles.captureButton} onPress={capturePhoto} disabled={isProcessing}>
              <View style={styles.captureButtonInner} />
            </TouchableOpacity>
            
            <View style={styles.galleryButtonPlaceholder} />
          </View>
        </>
      ) : (
        <View style={styles.previewContainer}>
          {currentImage && (
            <View style={styles.previewImageWrapper}>
              <Image source={{ uri: 'file://' + currentImage }} style={StyleSheet.absoluteFill} resizeMode="contain" />
              {appState === 'CAPTURED' && detectedEdges?.found && imageSize && (
                <Cropper
                  imageWidth={imageSize.width}
                  imageHeight={imageSize.height}
                  initialEdges={detectedEdges}
                  onCornersUpdate={(corners) => setDetectedEdges({ ...detectedEdges, ...corners })}
                />
              )}
            </View>
          )}
          <ScrollView style={styles.controlsScroll} contentContainerStyle={styles.controlsContainer}>
            {appState === 'CAPTURED' && detectedEdges?.found && (
              <TouchableOpacity style={styles.actionBtn} onPress={handleManualCrop}>
                <Text style={styles.actionBtnText}>Auto Crop Document</Text>
              </TouchableOpacity>
            )}
            {(appState === 'CROPPED' || appState === 'FILTERED') && (
              <View>
                <Text style={styles.sectionTitle}>Apply Filter</Text>
                <View style={styles.row}>
                  <TouchableOpacity style={[styles.actionBtn, styles.flexBtn]} onPress={() => handleFilter('lightened')}>
                    <Text style={styles.actionBtnText}>Lighten</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.actionBtn, styles.flexBtn, {backgroundColor: '#34C759'}]} onPress={() => handleFilter('magic_color')}>
                    <Text style={styles.actionBtnText}>Magic</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.actionBtn, styles.flexBtn, {backgroundColor: '#666'}]} onPress={() => handleFilter('bw')}>
                    <Text style={styles.actionBtnText}>B & W</Text>
                  </TouchableOpacity>
                </View>
                
                <TouchableOpacity style={[styles.actionBtn, {backgroundColor: '#FF9500', marginTop: 20}]} onPress={exportToGallery}>
                  <Text style={[styles.actionBtnText, {fontSize: 16}]}>💾 Save to Gallery</Text>
                </TouchableOpacity>
              </View>
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
          <Text style={{color: '#FFF', marginTop: 10}}>Processing...</Text>
        </View>
      )}
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#FFF' },
  targetingOverlay: { ...StyleSheet.absoluteFillObject, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.3)' },
  targetingBox: { width: '85%', height: '65%', borderWidth: 2, borderColor: 'rgba(255,255,255,0.8)', borderRadius: 12, borderStyle: 'dashed', backgroundColor: 'transparent' },
  targetingText: { color: 'rgba(255,255,255,0.9)', fontSize: 16, marginTop: 20, backgroundColor: 'rgba(0,0,0,0.6)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, overflow: 'hidden' },
  captureOverlay: { position: 'absolute', bottom: 40, width: '100%', flexDirection: 'row', justifyContent: 'space-evenly', alignItems: 'center' },
  captureButton: { width: 80, height: 80, borderRadius: 40, backgroundColor: 'rgba(255,255,255,0.3)', justifyContent: 'center', alignItems: 'center' },
  captureButtonInner: { width: 64, height: 64, borderRadius: 32, backgroundColor: '#FFF' },
  galleryButton: { width: 50, height: 50, borderRadius: 25, backgroundColor: 'rgba(255,255,255,0.2)', justifyContent: 'center', alignItems: 'center' },
  galleryButtonText: { fontSize: 24 },
  galleryButtonPlaceholder: { width: 50 },
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
