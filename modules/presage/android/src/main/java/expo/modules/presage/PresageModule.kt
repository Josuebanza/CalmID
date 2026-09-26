package expo.modules.presage

import com.presagetech.smartspectra.CameraPosition
import com.presagetech.smartspectra.SmartSpectraConfig
import com.presagetech.smartspectra.SmartSpectraSdk
import expo.modules.kotlin.functions.Coroutine
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class PresageModule : Module() {
  private val sdk
    get() = SmartSpectraSdk.shared

  override fun definition() = ModuleDefinition {
    Name("Presage")

    Function("configure") { apiKey: String ->
      sdk.config.apiKey = apiKey
      sdk.config.cameraPosition = CameraPosition.FRONT
      sdk.config.imageOutputEnabled = false
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
        "breathingRate" to breathingRate
      )
    }
  }
}