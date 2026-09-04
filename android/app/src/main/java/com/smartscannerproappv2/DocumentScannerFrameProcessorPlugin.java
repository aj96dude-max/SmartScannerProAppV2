package com.smartscannerproappv2;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;

import com.mrousavy.camera.frameprocessors.Frame;
import com.mrousavy.camera.frameprocessors.FrameProcessorPlugin;
import com.mrousavy.camera.frameprocessors.VisionCameraProxy;

import android.media.Image;
import java.nio.ByteBuffer;
import java.util.Map;
import java.util.HashMap;

public class DocumentScannerFrameProcessorPlugin extends FrameProcessorPlugin {
    
    // Declare the native JNI method
    private native float[] detectEdgesFromBuffer(ByteBuffer yBuffer, int width, int height, int rowStride);

    public DocumentScannerFrameProcessorPlugin(VisionCameraProxy proxy, @Nullable Map<String, Object> options) {
        super();
    }

    @Nullable
    @Override
    public Object callback(@NonNull Frame frame, @Nullable Map<String, Object> arguments) {
        Image image;
        try {
            image = frame.getImage();
        } catch (com.mrousavy.camera.core.FrameInvalidError e) {
            return null;
        }
        if (image == null) return null;

        // We only need the Y plane (grayscale) for edge detection
        Image.Plane yPlane = image.getPlanes()[0];
        ByteBuffer yBuffer = yPlane.getBuffer();
        
        int width = image.getWidth();
        int height = image.getHeight();
        int rowStride = yPlane.getRowStride();

        // Call C++ JNI method
        float[] edges = detectEdgesFromBuffer(yBuffer, width, height, rowStride);
        if (edges == null || edges.length != 8) return null;
        
        Map<String, Object> result = new HashMap<>();
        Map<String, Object> tl = new HashMap<>(); tl.put("x", (double) edges[0]); tl.put("y", (double) edges[1]);
        Map<String, Object> tr = new HashMap<>(); tr.put("x", (double) edges[2]); tr.put("y", (double) edges[3]);
        Map<String, Object> br = new HashMap<>(); br.put("x", (double) edges[4]); br.put("y", (double) edges[5]);
        Map<String, Object> bl = new HashMap<>(); bl.put("x", (double) edges[6]); bl.put("y", (double) edges[7]);
        
        result.put("found", true);
        result.put("tl", tl);
        result.put("tr", tr);
        result.put("br", br);
        result.put("bl", bl);
        
        return result;
    }
}
