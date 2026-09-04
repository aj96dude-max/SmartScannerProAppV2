# SmartScannerProAppV2 - Project Handoff & Plan

This document serves as a comprehensive context file for **Gemini Pro** (or any other AI assistant) to quickly understand the current state of the React Native Smart Scanner project, what has been achieved, and what the immediate next steps are to get the app production-ready.

## 🎯 Project Goal
To build a high-performance, real-time document scanning app in React Native (`SmartScannerProAppV2`). The app uses `react-native-vision-camera` for camera access and a custom C++ engine (OpenCV via JNI) to perform real-time document edge detection (live green bounding box) and subsequent document cropping, perspective transformation, and image filtering.

## 🏗️ Architecture & Tech Stack
- **Framework**: React Native (v0.75.3)
- **Camera**: `react-native-vision-camera` (v4.x)
- **Real-time Frame Processing**: `react-native-worklets-core` (required for VisionCamera v4)
- **Animations/UI**: `react-native-reanimated`, `react-native-svg` (for drawing the live edge polygon)
- **Native Android Layer**: Java (JNI) bridge to interact with the C++ engine.
- **Computer Vision**: OpenCV (C++) for edge detection, cropping, perspective warp, and color filtering.

## 📂 Key Working Files
| File Path | Description |
|-----------|-------------|
| `App.tsx` | Main UI. Handles camera permissions, live edge rendering via SVG, capturing photos, and calling native crop/filter methods. |
| `index.js` | App entry point. **CRITICAL**: Imports `react-native-worklets-core` and `react-native-reanimated` before AppRegistry to prevent `WORKLET doesn't exist` crashes. |
| `babel.config.js` | Configures the Babel plugins. The `react-native-worklets-core/plugin` is configured alongside Reanimated. |
| `android/app/src/main/java/com/smartscannerproappv2/DocumentScannerFrameProcessorPlugin.java` | The Vision Camera Frame Processor plugin. Extracts the Y-plane (grayscale) from the camera frame and passes it to C++ for live edge detection. Returns coordinates `(tl, tr, br, bl)` to JS. |
| `android/app/src/main/java/com/smartscannerproappv2/SmartScannerModule.java` | React Native module exposing static methods for processing static images (crop, magic color, black & white). |
| `android/app/src/main/cpp/*` | OpenCV C++ source files. Contains the math and computer vision logic for edge detection and image transformation. |

## ✅ What Has Been Achieved / Fixed
1. **Windows Build Constraints Fixed**: Overrode `buildStagingDirectory` in `build.gradle` for Reanimated, Worklets, and VisionCamera to bypass the Windows 260-character path limit.
2. **Worklets Integration Fixed**: Fixed the infamous `WORKLET doesn't exist` error by ensuring `react-native-worklets-core` is properly installed, linked in `babel.config.js`, and imported at the very top of `index.js`.
3. **JSI Type Conversion Crash Fixed**: Fixed an Android runtime crash (`Cannot convert Java type class java.lang.Float to jsi::Value!`) in `DocumentScannerFrameProcessorPlugin.java` by explicitly casting Java `Float` arrays from C++ to `Double` before placing them into the `HashMap` returned to JavaScript.
4. **App Builds and Runs**: The app successfully compiles via `npm run android`, installs via ADB, connects to Metro, and the camera feed opens.

## 🚀 What We Are Doing Now (Next Steps)
To get the app fully fixed and ready to use ASAP, focus on the following:

### 1. Verify Live Edge Detection Stability
- Monitor the app while the camera is pointed at a document.
- Check if the green SVG polygon accurately maps to the edges of the document.
- **Potential Issue**: If coordinates are misaligned, check the mapping logic in `App.tsx` (the frame aspect ratio vs. screen aspect ratio) or the rotation metadata in `DocumentScannerFrameProcessorPlugin.java`.

### 2. Verify Cropping and Image Processing
- Test the `capturePhoto` flow and the `handleAutoCrop` function.
- **Risk Area**: Ensure the C++ JNI bridge in `SmartScannerModule.java` does not crash when applying `SmartScanner.crop()` or `SmartScanner.applyFilter()`. Memory leaks or invalid pointer references in OpenCV C++ often cause hard crashes here.

### 3. UI Polish and UX Flow
- Complete the handoff from the `CAMERA` state to the `CROPPED` and `FILTERED` states in `App.tsx`.
- Add functionality to save the final processed image to the device gallery (e.g., using `@react-native-camera-roll/camera-roll` or `react-native-fs`).

## 🛠️ Troubleshooting Guidelines for Gemini Pro
- **If ADB disconnects / Red Screen (NetworkError)**: The user is on Windows, and the USB connection to the Infinix device is unstable. Always rely on Wi-Fi debugging or restarting the Metro server (`npm start -- --reset-cache`).
- **If C++ Crashes**: Native crashes will terminate the app silently or print an `A/libc: Fatal signal` in `adb logcat`. Always ask the user to run `adb logcat -d` after a crash to read the C++ stack trace.
- **If Worklets crash**: Ensure `index.js` imports are intact and `babel.config.js` is correct. Any changes to `babel.config.js` require a Metro cache reset.

---
**End of Handoff Document**
