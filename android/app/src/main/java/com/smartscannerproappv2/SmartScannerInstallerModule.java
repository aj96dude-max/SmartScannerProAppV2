package com.smartscannerproappv2;

import androidx.annotation.NonNull;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;

public class SmartScannerInstallerModule extends ReactContextBaseJavaModule {
    static {
        System.loadLibrary("smartscanner");
    }

    public SmartScannerInstallerModule(ReactApplicationContext reactContext) {
        super(reactContext);
    }

    @NonNull
    @Override
    public String getName() {
        return "SmartScannerInstaller";
    }

    private native void installNativeJsi(long jsiPtr);

    @ReactMethod(isBlockingSynchronousMethod = true)
    public boolean install() {
        try {
            long jsiPtr = getReactApplicationContext().getJavaScriptContextHolder().get();
            installNativeJsi(jsiPtr);
            return true;
        } catch (Exception e) {
            return false;
        }
    }
}
