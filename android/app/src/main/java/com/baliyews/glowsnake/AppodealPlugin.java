package com.baliyews.glowsnake;

import android.app.Activity;
import android.util.Log;
import com.appodeal.ads.Appodeal;
import com.appodeal.ads.RewardedVideoCallbacks;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "AppodealPlugin")
public class AppodealPlugin extends Plugin {
    private static final String TAG = "AppodealPlugin";
    public static final String APP_KEY = "ad0a3960bb2bda92195a92a2243e7eeb7cf7182031821602";

    private PluginCall activeRewardCall = null;
    private boolean isInitialized = false;

    @Override
    public void load() {
        super.load();
        initAppodeal();
    }

    public void initAppodeal() {
        Activity activity = getActivity();
        if (activity == null) return;

        activity.runOnUiThread(() -> {
            try {
                // Activate Test Mode for Appodeal ads as requested by user
                Appodeal.setTesting(true);

                // Setup Rewarded Video Callbacks
                Appodeal.setRewardedVideoCallbacks(new RewardedVideoCallbacks() {
                    @Override
                    public void onRewardedVideoLoaded(boolean isPrecache) {
                        Log.d(TAG, "onRewardedVideoLoaded, isPrecache: " + isPrecache);
                        JSObject data = new JSObject();
                        data.put("isPrecache", isPrecache);
                        notifyListeners("onRewardedVideoLoaded", data);
                    }

                    @Override
                    public void onRewardedVideoFailedToLoad() {
                        Log.w(TAG, "onRewardedVideoFailedToLoad");
                        notifyListeners("onRewardedVideoFailedToLoad", new JSObject());
                    }

                    @Override
                    public void onRewardedVideoShown() {
                        Log.d(TAG, "onRewardedVideoShown");
                        notifyListeners("onRewardedVideoShown", new JSObject());
                    }

                    @Override
                    public void onRewardedVideoShowFailed() {
                        Log.e(TAG, "onRewardedVideoShowFailed");
                        if (activeRewardCall != null) {
                            activeRewardCall.reject("Reklam göstərilməsi uğursuz oldu (Ad show failed)");
                            activeRewardCall = null;
                        }
                        notifyListeners("onRewardedVideoShowFailed", new JSObject());
                    }

                    @Override
                    public void onRewardedVideoClicked() {
                        Log.d(TAG, "onRewardedVideoClicked");
                        notifyListeners("onRewardedVideoClicked", new JSObject());
                    }

                    @Override
                    public void onRewardedVideoFinished(double amount, String currency) {
                        Log.d(TAG, "onRewardedVideoFinished: amount=" + amount + ", currency=" + currency);
                        if (activeRewardCall != null) {
                            JSObject ret = new JSObject();
                            ret.put("rewardEarned", true);
                            ret.put("amount", amount > 0 ? amount : 1.0);
                            ret.put("currency", currency != null ? currency : "coins");
                            activeRewardCall.resolve(ret);
                            activeRewardCall = null;
                        }
                        JSObject data = new JSObject();
                        data.put("amount", amount);
                        data.put("currency", currency);
                        notifyListeners("onRewardedVideoFinished", data);
                    }

                    @Override
                    public void onRewardedVideoClosed(boolean finished) {
                        Log.d(TAG, "onRewardedVideoClosed, finished=" + finished);
                        if (activeRewardCall != null) {
                            JSObject ret = new JSObject();
                            ret.put("rewardEarned", finished);
                            ret.put("amount", finished ? 1.0 : 0.0);
                            activeRewardCall.resolve(ret);
                            activeRewardCall = null;
                        }
                        JSObject data = new JSObject();
                        data.put("finished", finished);
                        notifyListeners("onRewardedVideoClosed", data);
                    }

                    @Override
                    public void onRewardedVideoExpired() {
                        Log.d(TAG, "onRewardedVideoExpired");
                    }
                });

                // Initialize Appodeal SDK with REWARDED_VIDEO format
                Appodeal.initialize(activity, APP_KEY, Appodeal.REWARDED_VIDEO);
                isInitialized = true;
                Log.i(TAG, "Appodeal SDK successfully initialized with Test Mode enabled for app: " + APP_KEY);
            } catch (Exception e) {
                Log.e(TAG, "Appodeal initialization exception: " + e.getMessage(), e);
            }
        });
    }

    @PluginMethod
    public void initialize(PluginCall call) {
        if (!isInitialized) {
            initAppodeal();
        }
        JSObject ret = new JSObject();
        ret.put("initialized", isInitialized);
        ret.put("testMode", true);
        ret.put("appKey", APP_KEY);
        call.resolve(ret);
    }

    @PluginMethod
    public void isRewardedVideoLoaded(PluginCall call) {
        boolean loaded = Appodeal.isLoaded(Appodeal.REWARDED_VIDEO);
        JSObject ret = new JSObject();
        ret.put("loaded", loaded);
        call.resolve(ret);
    }

    @PluginMethod
    public void showRewardedVideo(PluginCall call) {
        Activity activity = getActivity();
        if (activity == null) {
            call.reject("Activity is null");
            return;
        }

        activity.runOnUiThread(() -> {
            try {
                if (Appodeal.isLoaded(Appodeal.REWARDED_VIDEO)) {
                    activeRewardCall = call;
                    Appodeal.show(activity, Appodeal.REWARDED_VIDEO);
                } else {
                    // Start caching if not already loaded
                    Appodeal.cache(activity, Appodeal.REWARDED_VIDEO);
                    call.reject("Reklam hələ tam yüklənməyib. Zəhmət olmasa bir neçə saniyə sonra yenidən cəhd edin.");
                }
            } catch (Exception e) {
                call.reject("Xəta baş verdi: " + e.getMessage());
            }
        });
    }
}
