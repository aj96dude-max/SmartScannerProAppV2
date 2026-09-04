# Phase 2: C++ JNI Image Processing Bridge & Stabilization

## Goal
To stabilize the live edge detection using advanced OpenCV heuristics (fortified contour filtering) and ensure the JNI bridge is robust (fail-safe returns) without relying on heavy third-party ML dependencies. This will prevent the bounding box from jumping erratically and prevent native `A/libc` fatal crashes if an image buffer is empty.

## User Review Required
Please review the proposed C++ OpenCV modifications. Once approved, I will apply these changes to the native source files. You will need to rebuild the app (`npm run android`) after this phase is completed because we are modifying the native C++ library.

## Open Questions
- Is a minimum document area of 15% (of the total screen) acceptable? This means if a receipt is extremely far away, it might not be detected until you move the camera closer.

## Proposed Changes

### [MODIFY] `android/app/src/main/cpp/EdgeDetector.cpp`
We will rewrite the `detectDocumentEdges` method to:
- **Increase Blur**: Update `GaussianBlur` to a `7x7` kernel for more aggressive texture noise reduction (e.g. wood grains, wallets).
- **Enforce 15% Area Rule**: Calculate `totalArea = inputFrame.cols * inputFrame.rows`. Reject any contours where `contourArea(c) < totalArea * 0.15`.
- **Strict 4-Point Check**: Only accept a contour if `approxPolyDP` yields exactly 4 points. If no valid contour is found, return `docQuad.found = false` (null).

### [MODIFY] `android/app/src/main/cpp/SmartScannerModule.cpp`
We will audit and update the JNI methods (`cropImage`, `applyFilter`, `removeHand`):
- **Fail-Safe Fallbacks**: Replace `return Value(false);` with `return facebook::jsi::String::createFromUtf8(runtime, path);`. If OpenCV fails to read the image (`image.empty()`) or if a transformation fails, it will gracefully return the original image path back to React Native. This prevents the JS thread from crashing or receiving unexpected boolean types when it expects a string URI.
- **Null Safety**: Add checks before calling OpenCV methods like `imwrite` to ensure the `cv::Mat` objects are not empty.

## Verification Plan
1. Apply the changes.
2. Instruct the user to recompile the native Android app (`npm run android`).
3. Verify that the live edge detection is significantly more stable (less jumping).
4. Verify that capturing and cropping a photo works without crashing.
