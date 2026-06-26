package com.mixmind.slidingpuzzle

import android.media.AudioAttributes
import android.media.SoundPool
import android.os.SystemClock
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

class TileSoundModule(reactContext: ReactApplicationContext) :
  ReactContextBaseJavaModule(reactContext) {

  private val soundPool: SoundPool = SoundPool.Builder()
    .setMaxStreams(4)
    .setAudioAttributes(
      AudioAttributes.Builder()
        .setUsage(AudioAttributes.USAGE_GAME)
        .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
        .build(),
    )
    .build()

  private val soundIds = mutableMapOf<String, Int>()
  private val loadedSoundIds = mutableSetOf<Int>()
  private val pendingSoundIds = mutableMapOf<Int, Int>()
  private val lastPlayedAtByName = mutableMapOf<String, Long>()

  init {
    soundPool.setOnLoadCompleteListener { _, sampleId, status ->
      if (status != 0) return@setOnLoadCompleteListener

      synchronized(this) {
        loadedSoundIds.add(sampleId)
        val pendingCount = pendingSoundIds.remove(sampleId) ?: 0
        repeat(pendingCount.coerceAtMost(1)) {
          playLoadedSound(sampleId)
        }
      }
    }

    soundIds["select"] = soundPool.load(reactContext, R.raw.select, 1)
    soundIds["error"] = soundPool.load(reactContext, R.raw.error, 1)
    soundIds["gamestart"] = soundPool.load(reactContext, R.raw.gamestart, 1)
    soundIds["yay"] = soundPool.load(reactContext, R.raw.yay, 1)
  }

  override fun getName(): String = "TileSound"

  @ReactMethod
  fun playTileShuffleSound() {
    playSound("select", MIN_TILE_SOUND_GAP_MS)
  }

  @ReactMethod
  fun playTileErrorSound() {
    playSound("error", MIN_TILE_SOUND_GAP_MS)
  }

  @ReactMethod
  fun playGameStartSound() {
    playSound("gamestart", MIN_GAME_START_SOUND_GAP_MS)
  }

  @ReactMethod
  fun playGameWinSound() {
    playSound("yay", MIN_GAME_WIN_SOUND_GAP_MS)
  }

  private fun playSound(name: String, minimumGapMs: Long) {
    try {
      val now = SystemClock.elapsedRealtime()
      val lastPlayedAt = lastPlayedAtByName[name] ?: 0L
      if (now - lastPlayedAt < minimumGapMs) return

      lastPlayedAtByName[name] = now
      val soundId = soundIds[name] ?: return

      synchronized(this) {
        if (loadedSoundIds.contains(soundId)) {
          playLoadedSound(soundId)
        } else {
          pendingSoundIds[soundId] = (pendingSoundIds[soundId] ?: 0) + 1
        }
      }
    } catch (_: Throwable) {
      // Sound is a nice-to-have UI effect; never let audio failures affect gameplay.
    }
  }

  private fun playLoadedSound(soundId: Int) {
    soundPool.play(soundId, 1f, 1f, 1, 0, 1f)
  }

  override fun invalidate() {
    soundPool.release()
    super.invalidate()
  }

  private companion object {
    const val MIN_TILE_SOUND_GAP_MS = 45L
    const val MIN_GAME_START_SOUND_GAP_MS = 250L
    const val MIN_GAME_WIN_SOUND_GAP_MS = 1000L
  }
}
