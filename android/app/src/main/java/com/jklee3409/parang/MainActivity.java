package com.jklee3409.parang;

import com.getcapacitor.BridgeActivity;
import android.os.Bundle;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(SquishyHapticsPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
