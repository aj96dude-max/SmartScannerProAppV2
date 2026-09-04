#include <opencv2/opencv.hpp>
#include <vector>
#include <algorithm>

using namespace cv;
using namespace std;

class EdgeDetector {
public:
    // Structure to hold the 4 corners of a detected document
    struct DocumentQuad {
        Point2f tl, tr, br, bl;
        bool found = false;
    };

    /**
     * Core function running at 30+ FPS inside the Vision Camera Frame Processor.
     * Takes the live YUV/RGB frame and returns the 4 corners of the document.
     */
    static DocumentQuad detectDocumentEdges(const Mat& inputFrame) {
        Mat gray, blurred, edged;
        DocumentQuad docQuad;

        // 1. Convert to Grayscale
        if (inputFrame.channels() == 3 || inputFrame.channels() == 4) {
            cvtColor(inputFrame, gray, COLOR_BGR2GRAY);
        } else {
            gray = inputFrame;
        }

        // 2. Gaussian Blur to reduce noise and spurious edges (increased to 7x7 for stability)
        GaussianBlur(gray, blurred, Size(7, 7), 0);

        // 3. Canny Edge Detection
        // Using adaptive thresholds based on median image pixel intensity
        double medianIntensity = medianMat(gray);
        double lower = max(0.0, (1.0 - 0.33) * medianIntensity);
        double upper = min(255.0, (1.0 + 0.33) * medianIntensity);
        Canny(blurred, edged, lower, upper);

        // 4. Morphological Close to connect broken edge lines
        Mat kernel = getStructuringElement(MORPH_RECT, Size(5, 5));
        morphologyEx(edged, edged, MORPH_CLOSE, kernel);

        // 5. Find Contours
        vector<vector<Point>> contours;
        findContours(edged, contours, RETR_LIST, CHAIN_APPROX_SIMPLE);

        // Sort contours by area in descending order
        sort(contours.begin(), contours.end(), [](const vector<Point>& a, const vector<Point>& b) {
            return contourArea(a) > contourArea(b);
        });

        double totalArea = gray.cols * gray.rows;

        // 6. Iterate to find the largest valid 4-point contour (a quadrilateral)
        for (size_t i = 0; i < min(contours.size(), (size_t)5); i++) {
            double cArea = contourArea(contours[i]);
            
            // Discard if the contour takes up less than 15% of the frame area
            if (cArea < totalArea * 0.15) {
                break; // Since they are sorted, subsequent contours will also be too small
            }

            vector<Point> approx;
            double peri = arcLength(contours[i], true);
            // Approximate the polygonal curve
            approxPolyDP(contours[i], approx, 0.02 * peri, true);

            // Strict 4-point check: Only return if it has exactly 4 vertices
            if (approx.size() == 4 && isContourConvex(approx)) {
                docQuad.found = true;
                orderPoints(approx, docQuad);
                break;
            }
        }

        return docQuad;
    }

private:
    static double medianMat(Mat Input) {
        Input = Input.reshape(0, 1);
        vector<double> vecFromMat;
        Input.copyTo(vecFromMat);
        nth_element(vecFromMat.begin(), vecFromMat.begin() + vecFromMat.size() / 2, vecFromMat.end());
        return vecFromMat[vecFromMat.size() / 2];
    }

    /**
     * Orders points in top-left, top-right, bottom-right, bottom-left order
     */
    static void orderPoints(const vector<Point>& pts, DocumentQuad& quad) {
        vector<Point> sorted_pts = pts;
        
        // Sort by x coordinate
        sort(sorted_pts.begin(), sorted_pts.end(), [](const Point& a, const Point& b) {
            return a.x < b.x;
        });

        // Leftmost points
        Point left1 = sorted_pts[0];
        Point left2 = sorted_pts[1];
        if (left1.y < left2.y) {
            quad.tl = left1;
            quad.bl = left2;
        } else {
            quad.tl = left2;
            quad.bl = left1;
        }

        // Rightmost points
        Point right1 = sorted_pts[2];
        Point right2 = sorted_pts[3];
        if (right1.y < right2.y) {
            quad.tr = right1;
            quad.br = right2;
        } else {
            quad.tr = right2;
            quad.br = right1;
        }
    }
};
