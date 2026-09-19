package com.jklee3409.parang;

import android.content.Context;
import android.os.Build;
import android.os.VibrationEffect;
import android.os.Vibrator;
import android.provider.Settings;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/** Short, non-repeating amplitude envelopes synchronized with toy motion. */
@CapacitorPlugin(name = "SquishyHaptics")
public class SquishyHapticsPlugin extends Plugin {
    private Vibrator vibrator() {
        return (Vibrator) getContext().getSystemService(Context.VIBRATOR_SERVICE);
    }

    @PluginMethod
    public void available(PluginCall call) {
        Vibrator vibrator = vibrator();
        JSObject result = new JSObject();
        result.put("supported", vibrator != null && vibrator.hasVibrator());
        call.resolve(result);
    }

    @PluginMethod
    public void play(PluginCall call) {
        Vibrator vibrator = vibrator();
        if (vibrator == null || !vibrator.hasVibrator() ||
            Settings.System.getInt(getContext().getContentResolver(), Settings.System.HAPTIC_FEEDBACK_ENABLED, 1) == 0) {
            call.resolve(); return;
        }
        String type = call.getString("type", "press");
        double strength = Math.max(.2, Math.min(1, call.getDouble("strength", 1.0)));
        long[] timings;
        int[] amplitudes;
        switch (type) {
            case "stretch": timings = new long[]{0, 9}; amplitudes = new int[]{0, 45}; break;
            case "release": timings = new long[]{0, 14, 26, 10}; amplitudes = new int[]{0, 105, 0, 45}; break;
            case "land": timings = new long[]{0, 18, 12, 20, 24, 10}; amplitudes = new int[]{0, 150, 85, 40, 0, 25}; break;
            case "wave": timings = new long[]{0, 9, 65, 9}; amplitudes = new int[]{0, 55, 0, 40}; break;
            case "jump": timings = new long[]{0, 10}; amplitudes = new int[]{0, 65}; break;
            default: timings = new long[]{0, 8, 15, 12}; amplitudes = new int[]{0, 35, 65, 95};
        }
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && vibrator.hasAmplitudeControl()) {
                for (int i = 0; i < amplitudes.length; i++) amplitudes[i] = (int) (amplitudes[i] * strength);
                vibrator.vibrate(VibrationEffect.createWaveform(timings, amplitudes, -1));
            } else if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                vibrator.vibrate(VibrationEffect.createOneShot(type.equals("land") ? 24 : 12, VibrationEffect.DEFAULT_AMPLITUDE));
            } else {
                vibrator.vibrate(type.equals("land") ? 24 : 12);
            }
            call.resolve();
        } catch (RuntimeException e) { call.reject("Haptic feedback unavailable", e); }
    }

    @PluginMethod
    public void stop(PluginCall call) {
        cancel(); call.resolve();
    }

    private void cancel() { Vibrator vibrator = vibrator(); if (vibrator != null) vibrator.cancel(); }
    @Override protected void handleOnPause() { cancel(); }
    @Override protected void handleOnDestroy() { cancel(); }
}
