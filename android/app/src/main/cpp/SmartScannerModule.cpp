#include <jsi/jsi.h>
#include <jni.h>
#include <opencv2/opencv.hpp>
#include "EdgeDetector.cpp"
#include "ImageEnhancer.cpp"
#include "Inpainting.cpp"

using namespace facebook::jsi;
using namespace std;
using namespace cv;

// Helper to convert JSI string to std::string
std::string jsiStringToStdString(Runtime& runtime, const Value& val) {
    if (!val.isString()) return "";
    return val.asString(runtime).utf8(runtime);
}

void installSmartScanner(Runtime& jsiRuntime) {
    
    // 1. detectDocumentEdges(imagePath)
    auto detectEdges = Function::createFromHostFunction(
        jsiRuntime, PropNameID::forAscii(jsiRuntime, "detectDocumentEdges"), 1, 
        [](Runtime& runtime, const Value& thisValue, const Value* arguments, size_t count) -> Value {
            std::string path = jsiStringToStdString(runtime, arguments[0]);
            Mat image = imread(path);
            
            Object result(runtime);
            if (image.empty()) {
                result.setProperty(runtime, "found", false);
                return result;
            }

            EdgeDetector::DocumentQuad quad = EdgeDetector::detectDocumentEdges(image);
            result.setProperty(runtime, "found", quad.found);
            
            if (quad.found) {
                Object tl(runtime), tr(runtime), br(runtime), bl(runtime);
                tl.setProperty(runtime, "x", quad.tl.x); tl.setProperty(runtime, "y", quad.tl.y);
                tr.setProperty(runtime, "x", quad.tr.x); tr.setProperty(runtime, "y", quad.tr.y);
                br.setProperty(runtime, "x", quad.br.x); br.setProperty(runtime, "y", quad.br.y);
                bl.setProperty(runtime, "x", quad.bl.x); bl.setProperty(runtime, "y", quad.bl.y);
                
                result.setProperty(runtime, "tl", std::move(tl));
                result.setProperty(runtime, "tr", std::move(tr));
                result.setProperty(runtime, "br", std::move(br));
                result.setProperty(runtime, "bl", std::move(bl));
            }
            return result;
        }
    );
    jsiRuntime.global().setProperty(jsiRuntime, "detectDocumentEdges", std::move(detectEdges));

    // 2. cropImage(imagePath, tl_x, tl_y, tr_x, tr_y, br_x, br_y, bl_x, bl_y)
    auto cropImage = Function::createFromHostFunction(
        jsiRuntime, PropNameID::forAscii(jsiRuntime, "cropImage"), 9, 
        [](Runtime& runtime, const Value& thisValue, const Value* arguments, size_t count) -> Value {
            std::string path = jsiStringToStdString(runtime, arguments[0]);
            Mat image = imread(path);
            if (image.empty()) return facebook::jsi::String::createFromUtf8(runtime, path);

            Point2f tl(arguments[1].asNumber(), arguments[2].asNumber());
            Point2f tr(arguments[3].asNumber(), arguments[4].asNumber());
            Point2f br(arguments[5].asNumber(), arguments[6].asNumber());
            Point2f bl(arguments[7].asNumber(), arguments[8].asNumber());

            Mat cropped = ImageEnhancer::deskew(image, tl, tr, br, bl);
            if (cropped.empty()) return facebook::jsi::String::createFromUtf8(runtime, path);

            std::string outPath = path.substr(0, path.find_last_of('.')) + "_cropped.jpg";
            imwrite(outPath, cropped);
            
            return facebook::jsi::String::createFromUtf8(runtime, outPath);
        }
    );
    jsiRuntime.global().setProperty(jsiRuntime, "cropImage", std::move(cropImage));

    // 3. applyFilter(imagePath, filterType)
    // filterType: "lightened", "magic_color", "bw"
    auto applyFilter = Function::createFromHostFunction(
        jsiRuntime, PropNameID::forAscii(jsiRuntime, "applyFilter"), 2, 
        [](Runtime& runtime, const Value& thisValue, const Value* arguments, size_t count) -> Value {
            std::string path = jsiStringToStdString(runtime, arguments[0]);
            std::string type = jsiStringToStdString(runtime, arguments[1]);
            
            Mat image = imread(path);
            if (image.empty()) return facebook::jsi::String::createFromUtf8(runtime, path);

            Mat filtered;
            if (type == "lightened") {
                filtered = ImageEnhancer::applyLightened(image);
            } else if (type == "magic_color") {
                filtered = ImageEnhancer::applyMagicColor(image);
            } else if (type == "bw") {
                filtered = ImageEnhancer::applyBlackAndWhite(image);
            } else {
                filtered = image; // Default no-op
            }

            if (filtered.empty()) return facebook::jsi::String::createFromUtf8(runtime, path);

            std::string outPath = path.substr(0, path.find_last_of('.')) + "_" + type + ".jpg";
            imwrite(outPath, filtered);
            
            return facebook::jsi::String::createFromUtf8(runtime, outPath);
        }
    );
    jsiRuntime.global().setProperty(jsiRuntime, "applyFilter", std::move(applyFilter));

    // 4. removeHand(imagePath)
    auto removeHand = Function::createFromHostFunction(
        jsiRuntime, PropNameID::forAscii(jsiRuntime, "removeHand"), 1, 
        [](Runtime& runtime, const Value& thisValue, const Value* arguments, size_t count) -> Value {
            std::string path = jsiStringToStdString(runtime, arguments[0]);
            Mat image = imread(path);
            if (image.empty()) return facebook::jsi::String::createFromUtf8(runtime, path);

            Mat skinMask = HandRemover::detectSkin(image);
            Mat cleaned = HandRemover::removeHand(image, skinMask);

            if (cleaned.empty()) return facebook::jsi::String::createFromUtf8(runtime, path);

            std::string outPath = path.substr(0, path.find_last_of('.')) + "_nohand.jpg";
            imwrite(outPath, cleaned);
            
            return facebook::jsi::String::createFromUtf8(runtime, outPath);
        }
    );
    jsiRuntime.global().setProperty(jsiRuntime, "removeHand", std::move(removeHand));
}

extern "C" JNIEXPORT void JNICALL
Java_com_smartscannerproappv2_SmartScannerInstallerModule_installNativeJsi(JNIEnv* env, jobject thiz, jlong jsiPtr) {
    auto runtime = reinterpret_cast<Runtime*>(jsiPtr);
    if (runtime) {
        installSmartScanner(*runtime);
    }
}

extern "C" JNIEXPORT jfloatArray JNICALL
Java_com_smartscannerproappv2_DocumentScannerFrameProcessorPlugin_detectEdgesFromBuffer(
    JNIEnv* env, jobject thiz, jobject yBuffer, jint width, jint height, jint rowStride) {
    
    if (yBuffer == nullptr) return nullptr;
    
    void* yPtr = env->GetDirectBufferAddress(yBuffer);
    if (yPtr == nullptr) return nullptr;
    
    // Create OpenCV Mat from the grayscale Y channel buffer
    Mat yMat(height, width, CV_8UC1, yPtr, rowStride);
    
    // Downscale the image to prevent overheating and maintain 30fps
    // E.g. max dimension 640
    float scale = 1.0f;
    int maxDim = max(width, height);
    if (maxDim > 640) {
        scale = 640.0f / maxDim;
    }
    
    Mat smallMat;
    resize(yMat, smallMat, Size(), scale, scale, INTER_AREA);
    
    EdgeDetector::DocumentQuad quad = EdgeDetector::detectDocumentEdges(smallMat);
    if (!quad.found) {
        return nullptr;
    }
    
    // Scale the coordinates back up to the original frame size
    float invScale = 1.0f / scale;
    jfloat results[8] = {
        (float)(quad.tl.x * invScale), (float)(quad.tl.y * invScale),
        (float)(quad.tr.x * invScale), (float)(quad.tr.y * invScale),
        (float)(quad.br.x * invScale), (float)(quad.br.y * invScale),
        (float)(quad.bl.x * invScale), (float)(quad.bl.y * invScale)
    };
    
    jfloatArray jArray = env->NewFloatArray(8);
    env->SetFloatArrayRegion(jArray, 0, 8, results);
    return jArray;
}
