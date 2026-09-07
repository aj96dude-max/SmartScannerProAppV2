import { NativeModules } from 'react-native';
import { VisionCameraProxy } from 'react-native-vision-camera';

const { SmartScannerInstaller } = NativeModules;
let isInstalled = false;

/**
 * Initializes the Smart Scanner native module.
 * Must be called before using any other functions.
 */
export function installSmartScanner(): boolean {
  if (isInstalled) {return true;}
  if (SmartScannerInstaller) {
    isInstalled = SmartScannerInstaller.install();
    return isInstalled;
  }
  console.warn('SmartScannerInstaller native module is not available');
  return false;
}

// Auto-install on import for convenience
installSmartScanner();

/**
 * Type declarations for the globally injected JSI functions.
 */
declare global {
  var detectDocumentEdges: (path: string, roiW: number, roiH: number) => any;
  var cropImage: (path: string, tlx: number, tly: number, trx: number, tr_y: number, brx: number, bry: number, blx: number, bly: number) => string | false;
  var applyFilter: (path: string, type: 'lightened' | 'magic_color' | 'bw') => string | false;
  var removeHand: (path: string) => string | false;
}

export type FilterType = 'lightened' | 'magic_color' | 'bw';

export interface Point {
  x: number;
  y: number;
}

export interface EdgesResult {
  found: boolean;
  tl: Point;
  tr: Point;
  br: Point;
  bl: Point;
}

export interface LiveEdgesResult extends EdgesResult {
  frameWidth: number;
  frameHeight: number;
}

/**
 * Vision Camera Frame Processor plugin for live document edge detection.
 */
export const detectDocumentEdgesLive = VisionCameraProxy.initFrameProcessorPlugin('detectDocumentEdgesLive', {});

export const SmartScanner = {
  /**
   * Detects document edges in a static image.
   * @param imagePath Local file path to the image
   * @param roiWidthPct ROI width percentage
   * @param roiHeightPct ROI height percentage
   * @returns EdgesResult containing the 4 corners of the document, or found: false
   */
  detectEdges(imagePath: string, roiWidthPct: number = 1.0, roiHeightPct: number = 1.0): EdgesResult {
    return global.detectDocumentEdges(imagePath, roiWidthPct, roiHeightPct);
  },

  /**
   * Crops an image based on provided corner coordinates and applies perspective correction.
   * @param imagePath Local file path to the image
   * @param corners The 4 corners of the document
   * @returns The local file path of the cropped image, or false if failed
   */
  crop(imagePath: string, corners: Omit<EdgesResult, 'found'>): string | false {
    const { tl, tr, br, bl } = corners;
    return global.cropImage(imagePath, tl.x, tl.y, tr.x, tr.y, br.x, br.y, bl.x, bl.y);
  },

  /**
   * Applies an enhancement filter to the image.
   * @param imagePath Local file path to the image
   * @param type The type of filter to apply
   * @returns The local file path of the filtered image, or false if failed
   */
  applyFilter(imagePath: string, type: FilterType): string | false {
    return global.applyFilter(imagePath, type);
  },

  /**
   * Uses AI heuristic to detect and remove a finger/hand obstructing the document edge.
   * @param imagePath Local file path to the image
   * @returns The local file path of the cleaned image, or false if failed
   */
  removeHand(imagePath: string): string | false {
    return global.removeHand(imagePath);
  },
};
