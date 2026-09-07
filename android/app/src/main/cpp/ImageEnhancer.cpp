#include <opencv2/opencv.hpp>
#include <vector>

using namespace cv;
using namespace std;

class ImageEnhancer {
public:
    /**
     * Applies perspective warp to deskew the image based on the 4 corners.
     */
    static Mat deskew(const Mat& src, Point2f tl, Point2f tr, Point2f br, Point2f bl) {
        // Compute the width of the new image
        float widthA = norm(br - bl);
        float widthB = norm(tr - tl);
        float maxWidth = max(int(widthA), int(widthB));

        // Compute the height of the new image
        float heightA = norm(tr - br);
        float heightB = norm(tl - bl);
        float maxHeight = max(int(heightA), int(heightB));

        // Construct destination points mapping to a perfect rectangle
        vector<Point2f> dst_pts = {
            Point2f(0, 0),
            Point2f(maxWidth - 1, 0),
            Point2f(maxWidth - 1, maxHeight - 1),
            Point2f(0, maxHeight - 1)
        };

        vector<Point2f> src_pts = {tl, tr, br, bl};

        // Get the perspective transform matrix and warp
        Mat M = getPerspectiveTransform(src_pts, dst_pts);
        Mat warped;
        warpPerspective(src, warped, M, Size(maxWidth, maxHeight));

        return warped;
    }

    /**
     * Lightened: Optimizes exposure, shadows, and highlights.
     */
    static Mat applyLightened(const Mat& src) {
        Mat lab, result;
        cvtColor(src, lab, COLOR_BGR2Lab);
        
        // Split LAB into L, A, B channels
        vector<Mat> lab_planes(3);
        split(lab, lab_planes);
        
        // Apply Contrast Limited Adaptive Histogram Equalization (CLAHE) to L-channel
        Ptr<CLAHE> clahe = createCLAHE(2.0, Size(8, 8));
        clahe->apply(lab_planes[0], lab_planes[0]);
        
        merge(lab_planes, lab);
        cvtColor(lab, result, COLOR_Lab2BGR);
        return result;
    }

    /**
     * Grayscale: Simple BGR to GRAY conversion (preserves shadows).
     */
    static Mat applyGrayscale(const Mat& src) {
        Mat gray;
        cvtColor(src, gray, COLOR_BGR2GRAY);
        // Convert back to BGR so it matches expected Mat formats down the line
        Mat result;
        cvtColor(gray, result, COLOR_GRAY2BGR);
        return result;
    }

    /**
     * Enhanced (Magic Color): Sharpens text, removes shadows, deeply corrects white balance.
     */
    static Mat applyMagicColor(const Mat& src) {
        // 1. Balance lighting via CLAHE
        Mat enhanced = applyLightened(src);

        // 2. Unsharp masking to make text extremely crisp
        Mat blurred, unsharpMask;
        GaussianBlur(enhanced, blurred, Size(0, 0), 3);
        addWeighted(enhanced, 1.5, blurred, -0.5, 0, unsharpMask);
        
        // 3. Boost Saturation
        Mat hsv, result;
        cvtColor(unsharpMask, hsv, COLOR_BGR2HSV);
        vector<Mat> hsv_planes(3);
        split(hsv, hsv_planes);
        hsv_planes[1] = hsv_planes[1] * 1.2; // Boost saturation by 20%
        merge(hsv_planes, hsv);
        cvtColor(hsv, result, COLOR_HSV2BGR);
        
        return result;
    }

    /**
     * B&W: Dynamic thresholding for crisp, ink-like text on pure white.
     */
    static Mat applyBlackAndWhite(const Mat& src) {
        Mat gray, result;
        if (src.channels() == 3 || src.channels() == 4) {
            cvtColor(src, gray, COLOR_BGR2GRAY);
        } else {
            gray = src.clone();
        }

        // Apply Gaussian Blur to remove noise
        GaussianBlur(gray, gray, Size(5, 5), 0);

        // Adaptive Gaussian Thresholding forces white background and black text
        adaptiveThreshold(gray, result, 255, ADAPTIVE_THRESH_GAUSSIAN_C, THRESH_BINARY, 21, 10);
        
        return result;
    }
};
