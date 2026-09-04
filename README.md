# Smart Scanner Pro - Core Engine Module

This repository contains the core processing engine and native JSI linkage for **Smart Scanner Pro**. It is designed as a modular core that handles all heavy lifting (C++ OpenCV Image Processing, Hardware Camera interactions) and provides a clean Javascript interface for the UI team to build upon.

## Architecture & How It Works

1. **JSI (Javascript Interface)**: We bypass the traditional async React Native bridge entirely. The C++ functions are injected directly into the Javascript global object, allowing synchronous, zero-latency calls from Javascript to C++.
2. **C++ Image Processing**: Housed in `android/app/src/main/cpp`, our `SmartScannerModule` handles all OpenCV operations (Edge Detection, Magic Color, Perspective Cropping, Hand Removal).
3. **Camera Pipeline & Real-Time Tracking**: Integrated with `react-native-vision-camera`. We built a custom Java Frame Processor Plugin (`DocumentScannerFrameProcessorPlugin`) that extracts the grayscale (Y-channel) byte buffer directly from the camera feed and passes it to an optimized C++ JNI method. This allows real-time (30fps) document edge tracking overlay without overheating the device.
4. **Interactive UI Cropper**: Powered by `react-native-gesture-handler` and `react-native-reanimated`, allowing smooth scaling and edge corner manipulations mapped precisely to the high-resolution captured image.

## Completed Features

- [x] **Real-time Live Subject Detection**: Animated SVG tracking box superimposed over documents in the camera preview.
- [x] **Interactive Perspective Cropping**: Draggable UI corners mapped to the original image coordinate space to perform perspective warp and flatten the document into a perfect rectangle.
- [x] **Post-capture Image Filters**: High-performance OpenCV filters including Lighten, Enhanced (Magic Color via CLAHE and Unsharp Masking), and B&W (Adaptive Gaussian Thresholding).
- [x] **AI/OpenCV Hand & Finger Removal**: Heuristic HSV skin-color segmentation paired with Telea Inpainting to seamlessly erase fingers from the edges of scans.

## Dependencies & Configuration

- `react-native`: 0.75.3
- `react-native-vision-camera`: ^4.0.5 (Used for camera preview, high-res captures, and Frame Processors)
- `react-native-gesture-handler` & `react-native-reanimated`: Interactive UI gestures and high-performance SVG animations on the UI thread.
- `react-native-svg`: Used to render the animated green tracking polygon bounding box over the live camera.
- `OpenCV`: C++ library included for all computer vision operations.

### Babel Configuration
Ensure that `react-native-reanimated/plugin` is added to your `babel.config.js` plugins list to enable UI thread animations.

### Frame Processor Registration
The native Java frame processor plugin (`detectDocumentEdgesLive`) is registered inside `SmartScannerPackage.java` and exposed synchronously to the React Native `useFrameProcessor` hook.

## Setup & Running

```bash
# Install NPM dependencies
npm install

# Run the Android app
npm run android
```
