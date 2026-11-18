package expo.modules.presage

import android.content.Context
import android.graphics.Color
import androidx.camera.view.PreviewView
import com.presagetech.smartspectra.CameraPosition
import com.presagetech.smartspectra.SmartSpectraConfig
import com.presagetech.smartspectra.SmartSpectraSdk
import expo.modules.kotlin.AppContext
import expo.modules.kotlin.functions.Coroutine
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import expo.modules.kotlin.views.ExpoView

/**
 * Native, real-time CameraX surface driven by SmartSpectra itself.
 *
 * This is NOT a second camera client. Presage owns camera capture; the same
 * frame stream drives the PreviewView and Presage's physiological processing.
 *
 * The React Native view must be mounted BEFORE Presage.start(), so that
 * previewSurfaceProvider is set before the SDK opens the camera.
 */
class PresageCameraView(
  context: Context,
  appContext: AppContext
) : ExpoView(context, appContext) {

  private val sdk get() = SmartSpectraSdk.shared

  private val previewView = PreviewView(context).apply {
    implementationMode = PreviewView.ImplementationMode.COMPATIBLE
    scaleType = PreviewView.ScaleType.FILL_CENTER
    setBackgroundColor(Color.BLACK)
    contentDescription = "Live Presage camera preview"
  }

  init {
    addView(
      previewView,
      LayoutParams(LayoutParams.MATCH_PARENT, LayoutParams.MATCH_PARENT)
    )
  }

  override fun onAttachedToWindow() {
    super.onAttachedToWindow()
    // Recommended by Presage's official Android CameraX quickstart.
    sdk.config.previewSurfaceProvider = previewView.surfaceProvider
  }

  override fun onDetachedFromWindow() {
    // React Native waits for Presage.stop() before unmounting on the regular
    // recovery path. The next view mount re-binds its own surface provider.
    sdk.config.previewSurfaceProvider = null
    super.onDetachedFromWindow()
  }
}

class PresageModule : Module() {
  private val sdk get() = SmartSpectraSdk.shared

  override fun definition() = ModuleDefinition {
    Name("Presage")

    View(PresageCameraView::class) {}

    Function("configure") { apiKey: String ->
      sdk.config.apiKey = apiKey
      sdk.config.cameraPosition = CameraPosition.FRONT
      // Native PreviewView avoids copying every Bitmap into an ImageView.
      sdk.config.imageOutputEnabled = false
      // Do NOT set previewSurfaceProvider = null here: the view already binds
      // it before start(). Clearing it here causes a black preview.
      sdk.config.requestedMetrics =
        SmartSpectraConfig.breathingMetrics +
        SmartSpectraConfig.cardioMetrics
      true
    }

    AsyncFunction("start") Coroutine { ->
      sdk.start()
      true
    }

    AsyncFunction("stop") Coroutine { ->
      sdk.stop()
      true
    }

    Function("getStatus") {
      sdk.processingStatus.value?.name ?: "UNKNOWN"
    }

    Function("getVitals") {
      val metrics = sdk.metrics.value
      val validation = sdk.validationStatus.value
      val sdkError = sdk.error.value

      var pulse: Double? = null
      var breathingRate: Double? = null

      if (metrics != null) {
        if (metrics.hasCardio()) {
          pulse = metrics.cardio.pulseRateList
            .lastOrNull { it.timestamp > 0 }
            ?.value
            ?.toDouble()
        }
        if (metrics.hasBreathing() && metrics.breathing.rateCount > 0) {
          breathingRate = metrics.breathing.rateList
            .lastOrNull()
            ?.value
            ?.toDouble()
        }
      }

      mapOf(
        "pulse" to pulse,
        "breathingRate" to breathingRate,
        "validationCode" to validation?.code?.name,
        "validationHint" to validation?.hint,
        "error" to sdkError?.message
      )
    }
  }
}
