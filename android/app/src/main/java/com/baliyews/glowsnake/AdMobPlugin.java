package com.baliyews.glowsnake;

import android.app.Activity;
import android.util.Log;
import androidx.annotation.NonNull;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.google.android.gms.ads.AdError;
import com.google.android.gms.ads.AdRequest;
import com.google.android.gms.ads.FullScreenContentCallback;
import com.google.android.gms.ads.LoadAdError;
import com.google.android.gms.ads.MobileAds;
import com.google.android.gms.ads.OnUserEarnedRewardListener;
import com.google.android.gms.ads.rewarded.RewardItem;
import com.google.android.gms.ads.rewarded.RewardedAd;
import com.google.android.gms.ads.rewarded.RewardedAdLoadCallback;

@CapacitorPlugin(name = "AdMobPlugin")
public class AdMobPlugin extends Plugin {
    private static final String TAG = "AdMobPlugin";
    public static final String AD_UNIT_ID = "ca-app-pub-9623198312339039/3138314476";
    public static final String TEST_AD_UNIT_ID = "ca-app-pub-3940256099942544/5224354917";

    private RewardedAd rewardedAd = null;
    private boolean isLoading = false;
    private boolean isInitialized = false;
    private PluginCall activeRewardCall = null;
    private boolean userEarnedReward = false;

    @Override
    public void load() {
        super.load();
        initAdMob();
    }

    public void initAdMob() {
        Activity activity = getActivity();
        if (activity == null) return;

        activity.runOnUiThread(() -> {
            try {
                MobileAds.initialize(activity, initializationStatus -> {
                    isInitialized = true;
                    Log.i(TAG, "Google AdMob SDK successfully initialized.");
                    loadRewardedAd();
                });
            } catch (Exception e) {
                Log.e(TAG, "AdMob initialization error: " + e.getMessage(), e);
            }
        });
    }

    private void loadRewardedAd() {
        loadRewardedAdInternal(AD_UNIT_ID, false);
    }

    private void loadRewardedAdInternal(String adUnitId, boolean isFallback) {
        Activity activity = getActivity();
        if (activity == null || isLoading || rewardedAd != null) return;

        isLoading = true;
        activity.runOnUiThread(() -> {
            AdRequest adRequest = new AdRequest.Builder().build();
            RewardedAd.load(activity, adUnitId, adRequest, new RewardedAdLoadCallback() {
                @Override
                public void onAdLoaded(@NonNull RewardedAd ad) {
                    rewardedAd = ad;
                    isLoading = false;
                    Log.i(TAG, "Rewarded ad successfully loaded (" + (isFallback ? "test unit" : "custom unit") + ").");
                    setupAdCallbacks(ad);
                }

                @Override
                public void onAdFailedToLoad(@NonNull LoadAdError loadAdError) {
                    rewardedAd = null;
                    isLoading = false;
                    Log.w(TAG, "Rewarded ad failed to load: " + loadAdError.getMessage() + " (code " + loadAdError.getCode() + ")");
                    // If custom ad unit is newly created and not yet serving (no fill), fallback to Google test unit for testing
                    if (!isFallback) {
                        Log.i(TAG, "Attempting fallback to Google test rewarded ad unit...");
                        loadRewardedAdInternal(TEST_AD_UNIT_ID, true);
                    }
                }
            });
        });
    }

    private void setupAdCallbacks(RewardedAd ad) {
        ad.setFullScreenContentCallback(new FullScreenContentCallback() {
            @Override
            public void onAdShowedFullScreenContent() {
                Log.d(TAG, "Ad showed full screen content.");
            }

            @Override
            public void onAdFailedToShowFullScreenContent(@NonNull AdError adError) {
                Log.e(TAG, "Ad failed to show: " + adError.getMessage());
                rewardedAd = null;
                loadRewardedAd();
                if (activeRewardCall != null) {
                    activeRewardCall.reject("Reklam göstərilməsi uğursuz oldu: " + adError.getMessage());
                    activeRewardCall = null;
                }
            }

            @Override
            public void onAdDismissedFullScreenContent() {
                Log.d(TAG, "Ad was dismissed.");
                rewardedAd = null;
                loadRewardedAd(); // Preload next ad
                if (activeRewardCall != null) {
                    JSObject ret = new JSObject();
                    ret.put("rewardEarned", userEarnedReward);
                    ret.put("amount", userEarnedReward ? 1 : 0);
                    ret.put("currency", "reward");
                    activeRewardCall.resolve(ret);
                    activeRewardCall = null;
                }
            }
        });
    }

    @PluginMethod
    public void initialize(PluginCall call) {
        if (!isInitialized) {
            initAdMob();
        }
        JSObject ret = new JSObject();
        ret.put("initialized", isInitialized);
        ret.put("adUnitId", AD_UNIT_ID);
        call.resolve(ret);
    }

    @PluginMethod
    public void isRewardedVideoLoaded(PluginCall call) {
        JSObject ret = new JSObject();
        ret.put("loaded", rewardedAd != null);
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
                if (rewardedAd != null) {
                    activeRewardCall = call;
                    userEarnedReward = false;
                    rewardedAd.show(activity, new OnUserEarnedRewardListener() {
                        @Override
                        public void onUserEarnedReward(@NonNull RewardItem rewardItem) {
                            userEarnedReward = true;
                            Log.d(TAG, "User earned reward: " + rewardItem.getAmount() + " " + rewardItem.getType());
                        }
                    });
                } else {
                    // Trigger load and inform user
                    loadRewardedAd();
                    call.reject("Reklam yüklənir, zəhmət olmasa bir neçə saniyə sonra yenidən cəhd edin.");
                }
            } catch (Exception e) {
                call.reject("Xəta baş verdi: " + e.getMessage());
            }
        });
    }
}
