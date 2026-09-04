#include <opencv2/opencv.hpp>
#include <opencv2/photo.hpp>

using namespace cv;
using namespace std;

class HandRemover {
public:
    /**
     * Generates a binary mask of skin tones (hands/fingers) using HSV heuristics.
     */
    static Mat detectSkin(const Mat& src) {
        Mat hsv, mask1, mask2, finalMask;
        cvtColor(src, hsv, COLOR_BGR2HSV);

        // Lower range of skin color in HSV
        inRange(hsv, Scalar(0, 20, 70), Scalar(20, 255, 255), mask1);
        
        // Upper range of skin color in HSV (wraps around in OpenCV Hue)
        inRange(hsv, Scalar(170, 20, 70), Scalar(180, 255, 255), mask2);
        
        finalMask = mask1 | mask2;

        // Clean up noise using morphological operations
        Mat kernel = getStructuringElement(MORPH_ELLIPSE, Size(11, 11));
        morphologyEx(finalMask, finalMask, MORPH_CLOSE, kernel);
        morphologyEx(finalMask, finalMask, MORPH_OPEN, kernel);

        return finalMask;
    }

    /**
     * Reconstructs the document background after a hand/finger is masked out.
     * @param src The cropped document image (with the finger on it).
     * @param mask A binary mask where the finger/hand is 255 (white) and rest is 0 (black).
     *             (Generated via detectSkin).
     * @return The inpainted, cleaned image.
     */
    static Mat removeHand(const Mat& src, const Mat& mask) {
        Mat result;
        
        // Ensure mask is single channel 8-bit
        Mat processedMask;
        if (mask.channels() > 1) {
            cvtColor(mask, processedMask, COLOR_BGR2GRAY);
        } else {
            processedMask = mask.clone();
        }

        // Dilate the mask slightly to ensure we cover the edge of the finger shadow
        Mat kernel = getStructuringElement(MORPH_ELLIPSE, Size(5, 5));
        dilate(processedMask, processedMask, kernel);

        // Apply OpenCV's Telea Inpainting algorithm
        // Telea is fast enough for on-device mobile execution and works well 
        // for continuing the document's background texture/color.
        // inpaintRadius = 3 (neighborhood size)
        inpaint(src, processedMask, result, 3, INPAINT_TELEA);
        
        return result;
    }
};
