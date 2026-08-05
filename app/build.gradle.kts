plugins {
    id("com.android.application")
}

android {
    namespace = "com.capuniformbuilder.app"
    compileSdk = 35

    defaultConfig {
        applicationId = "com.capuniformbuilder.app"
        minSdk = 26
        targetSdk = 35
        versionCode = 2
        versionName = "1.0.1"
    }

    buildTypes {
        release {
            isMinifyEnabled = false
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro"
            )
        }
    }
}

