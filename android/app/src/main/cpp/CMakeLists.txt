cmake_minimum_required(VERSION 3.18.1)
project(SmartScannerPro)

# Set the OpenCV path assuming we extract it here
set(OpenCV_DIR ${CMAKE_CURRENT_SOURCE_DIR}/opencv/sdk/native/jni)
find_package(OpenCV REQUIRED)

# Include React Native JSI headers
find_package(ReactAndroid REQUIRED CONFIG)

# The node_modules folder is typically at the root of the React Native project.
# From android/app/src/main/cpp, we need to go up 5 levels to reach the project root.
find_path(JSI_INCLUDE_DIR NAMES jsi/jsi.h
        HINTS "${CMAKE_CURRENT_SOURCE_DIR}/../../../../../node_modules/react-native/ReactCommon/jsi"
        NO_CMAKE_FIND_ROOT_PATH)

# Fallback search if the project structure differs slightly
if(NOT JSI_INCLUDE_DIR)
    find_path(JSI_INCLUDE_DIR NAMES jsi/jsi.h
            HINTS "${CMAKE_CURRENT_SOURCE_DIR}/../../../../node_modules/react-native/ReactCommon/jsi"
            NO_CMAKE_FIND_ROOT_PATH)
endif()

if(NOT JSI_INCLUDE_DIR)
    message(FATAL_ERROR "JSI_INCLUDE_DIR not found. Please ensure node_modules/react-native is installed at the project root.")
endif()

include_directories(${JSI_INCLUDE_DIR})
include_directories(${OpenCV_INCLUDE_DIRS})

# Add our custom C++ source files.
# SmartScannerModule.cpp already includes EdgeDetector.cpp, ImageEnhancer.cpp, and Inpainting.cpp.
# We only compile the main module to avoid duplicate symbol errors from multiple translation units.
add_library(
        smartscanner
        SHARED
        SmartScannerModule.cpp
)

target_link_libraries(
        smartscanner
        ${OpenCV_LIBS}
        ReactAndroid::jsi
        android
        log
)
