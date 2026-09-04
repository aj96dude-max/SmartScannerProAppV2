package com.smartscannerproappv2;

import androidx.annotation.NonNull;
import com.facebook.react.ReactPackage;
import com.facebook.react.bridge.NativeModule;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.uimanager.ViewManager;
import java.util.Collections;
import java.util.List;
import java.util.Arrays;

import com.mrousavy.camera.frameprocessors.FrameProcessorPluginRegistry;

public class SmartScannerPackage implements ReactPackage {

    static {
        FrameProcessorPluginRegistry.addFrameProcessorPlugin(
                "detectDocumentEdgesLive",
                (proxy, options) -> new DocumentScannerFrameProcessorPlugin(proxy, options)
        );
    }

    @NonNull
    @Override
    public List<NativeModule> createNativeModules(@NonNull ReactApplicationContext reactContext) {
        return Arrays.<NativeModule>asList(new SmartScannerInstallerModule(reactContext));
    }

    @NonNull
    @Override
    public List<ViewManager> createViewManagers(@NonNull ReactApplicationContext reactContext) {
        return Collections.emptyList();
    }
}
