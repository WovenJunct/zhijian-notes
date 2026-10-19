package app.zhijian.notes;
import android.app.*;import android.os.*;import android.content.*;import android.content.pm.ApplicationInfo;
import android.graphics.Color;import android.view.*;import android.webkit.*;import android.widget.FrameLayout;
import app.zhijian.notes.bridge.NativeBridge;import app.zhijian.notes.data.PaperDb;import app.zhijian.notes.files.AttachmentStore;import app.zhijian.notes.web.LocalContentClient;
public class MainActivity extends Activity {
 private WebView web;private NativeBridge bridge;
 @Override public void onCreate(Bundle b){super.onCreate(b);int paper=Color.rgb(247,243,235);getWindow().setStatusBarColor(paper);getWindow().setNavigationBarColor(paper);
  FrameLayout root=new FrameLayout(this);root.setBackgroundColor(paper);web=new WebView(this);web.setBackgroundColor(paper);root.addView(web,new FrameLayout.LayoutParams(-1,-1));setContentView(root);
  if(Build.VERSION.SDK_INT>=30){getWindow().setDecorFitsSystemWindows(false);root.setOnApplyWindowInsetsListener((v,insets)->{android.graphics.Insets bars=insets.getInsets(WindowInsets.Type.systemBars()),ime=insets.getInsets(WindowInsets.Type.ime());v.setPadding(bars.left,bars.top,bars.right,Math.max(bars.bottom,ime.bottom));return insets;});}
  else{getWindow().getDecorView().setSystemUiVisibility(View.SYSTEM_UI_FLAG_LAYOUT_STABLE|View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN|View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION|View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR|View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR);root.setOnApplyWindowInsetsListener((v,i)->{v.setPadding(i.getSystemWindowInsetLeft(),i.getSystemWindowInsetTop(),i.getSystemWindowInsetRight(),i.getSystemWindowInsetBottom());return i;});}
  WebSettings settings=web.getSettings();settings.setJavaScriptEnabled(true);settings.setDomStorageEnabled(false);settings.setAllowFileAccess(false);settings.setAllowContentAccess(false);settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);settings.setBlockNetworkLoads(true);settings.setBuiltInZoomControls(false);settings.setTextZoom(100);
  WebView.setWebContentsDebuggingEnabled((getApplicationInfo().flags&ApplicationInfo.FLAG_DEBUGGABLE)!=0);
  AttachmentStore files=new AttachmentStore(this);web.setWebViewClient(new LocalContentClient(this,files.directory));bridge=new NativeBridge(this,web,new PaperDb(this),files);web.addJavascriptInterface(bridge,"PaperNative");if(b==null)bridge.handleIntent(getIntent());else bridge.refreshReminders();web.loadUrl("https://paper.local/index.html");
  if(Build.VERSION.SDK_INT>=33)getOnBackInvokedDispatcher().registerOnBackInvokedCallback(android.window.OnBackInvokedDispatcher.PRIORITY_DEFAULT,this::handleBack);
 }
 private void handleBack(){web.evaluateJavascript("window.PaperApp?window.PaperApp.flushAndBack():false",value->{if("false".equals(value))finish();});}
 @Override protected void onNewIntent(Intent intent){super.onNewIntent(intent);setIntent(intent);if(bridge!=null)bridge.handleIntent(intent);}
 @Override public void onRequestPermissionsResult(int request,String[] permissions,int[] results){super.onRequestPermissionsResult(request,permissions,results);if(bridge!=null)bridge.refreshReminders();}
 @Override protected void onResume(){super.onResume();if(bridge!=null)bridge.refreshReminders();}
 // Legacy fallback only: API 33+ uses the registered OnBackInvokedDispatcher above.
 @android.annotation.SuppressLint("GestureBackNavigation")
 @Override public void onBackPressed(){handleBack();}
 @Override protected void onPause(){if(web!=null)web.evaluateJavascript("window.PaperApp&&window.PaperApp.flush().catch(function(){})",null);super.onPause();}
 @Override protected void onActivityResult(int req,int code,Intent data){super.onActivityResult(req,code,data);if(bridge!=null)bridge.documents().result(req,code,data);}
 @Override protected void onDestroy(){if(bridge!=null)bridge.close();if(web!=null){web.removeJavascriptInterface("PaperNative");web.destroy();}super.onDestroy();}
}
