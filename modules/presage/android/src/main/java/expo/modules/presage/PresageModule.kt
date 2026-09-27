package expo.modules.presage

import android.content.Context
import android.graphics.Bitmap
import android.graphics.Color
import android.widget.ImageView
import androidx.lifecycle.Observer
import com.presagetech.smartspectra.CameraPosition
import com.presagetech.smartspectra.SmartSpectraConfig
import com.presagetech.smartspectra.SmartSpectraSdk
import expo.modules.kotlin.AppContext
import expo.modules.kotlin.functions.Coroutine
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import expo.modules.kotlin.views.ExpoView

class PresageCameraView(
  context: Context,
  appContext: AppContext
) : ExpoView(context, appContext) {

  private val sdk
    get() = SmartSpectraSdk.shared

  private val cameraImage = ImageView(context).also {
    it.layoutParams = LayoutParams(
      LayoutParams.MATCH_PARENT,
      LayoutParams.MATCH_PARENT
    )

    it.scaleType = ImageView.ScaleType.CENTER_CROP
    it.setBackgroundColor(Color.BLACK)

    addView(it)
  }

  private val imageObserver =
    Observer<Bitmap?> { bitmap ->
      if (bitmap != null) {
        cameraImage.setImageBitmap(bitmap)
      }
    }

  override fun onAttachedToWindow() {
    super.onAttachedToWindow()

    // Affiche directement les frames produites
    // par SmartSpectra.
    sdk.imageOutput.observeForever(
      imageObserver
    )
  }

  override fun onDetachedFromWindow() {
    sdk.imageOutput.removeObserver(
      imageObserver
    )

    cameraImage.setImageDrawable(null)

    super.onDetachedFromWindow()
  }
}

class PresageModule : Module() {

  private val sdk
    get() = SmartSpectraSdk.shared

  override fun definition() =
    ModuleDefinition {

      Name("Presage")

      View(PresageCameraView::class) {}

      Function("configure") {
          apiKey: String ->

        sdk.config.apiKey = apiKey

        // Caméra selfie
        sdk.config.cameraPosition =
          CameraPosition.FRONT

        // IMPORTANT :
        // on demande à Presage de produire
        // les images utilisées par notre
        // PresageCameraView.
        sdk.config.imageOutputEnabled = true

        // On n'utilise plus le PreviewView
        // CameraX externe.
        sdk.config.previewSurfaceProvider =
          null

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
        sdk.processingStatus.value?.name
          ?: "UNKNOWN"
      }

      Function("getVitals") {

        val metrics =
          sdk.metrics.value

        val validation =
          sdk.validationStatus.value

        val sdkError =
          sdk.error.value

        var pulse: Double? = null

        var breathingRate: Double? =
          null

        if (metrics != null) {

          if (metrics.hasCardio()) {

            pulse =
              metrics.cardio.pulseRateList
                .lastOrNull {
                  it.timestamp > 0
                }
                ?.value
                ?.toDouble()
          }

          if (
            metrics.hasBreathing() &&
            metrics.breathing.rateCount > 0
          ) {

            breathingRate =
              metrics.breathing.rateList
                .lastOrNull()
                ?.value
                ?.toDouble()
          }
        }

        mapOf(
          "pulse" to pulse,

          "breathingRate" to
            breathingRate,

          "validationCode" to
            validation?.code?.name,

          "validationHint" to
            validation?.hint,

          "error" to
            sdkError?.message
        )
      }
    }
}