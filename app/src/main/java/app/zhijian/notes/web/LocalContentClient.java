package app.zhijian.notes.web;
import android.content.Context;import android.webkit.*;import android.net.Uri;
import java.io.*;import java.util.*;
public final class LocalContentClient extends WebViewClient {
 private final Context context;private final File media;
 public LocalContentClient(Context c,File media){context=c;this.media=media;}
 private WebResourceResponse blocked(){return new WebResourceResponse("text/plain","UTF-8",403,"Blocked",Collections.emptyMap(),new ByteArrayInputStream(new byte[0]));}
 @Override public WebResourceResponse shouldInterceptRequest(WebView view,WebResourceRequest request){
  Uri u=request.getUrl();if(!"https".equals(u.getScheme())||!"paper.local".equals(u.getHost())||u.getPort()!=-1||!"GET".equals(request.getMethod()))return blocked();String path=u.getPath();if(path==null)return blocked();if(path.equals("/"))path="/index.html";
  if(path.contains("..")||path.contains("\\"))return blocked();
  try{InputStream in;String mime;
   if(path.startsWith("/media/")){String name=path.substring(7);if(!name.matches("[a-zA-Z0-9_-]+\\.(png|jpg|jpeg|webp|gif)"))return blocked();File f=new File(media,name);in=new FileInputStream(f);mime=name.endsWith("png")?"image/png":name.endsWith("gif")?"image/gif":name.endsWith("webp")?"image/webp":"image/jpeg";}
   else{if(!path.matches("/[a-zA-Z0-9_/.-]+"))return blocked();in=context.getAssets().open("web"+path);mime=path.endsWith(".js")?"application/javascript":path.endsWith(".css")?"text/css":path.endsWith(".html")?"text/html":path.endsWith(".txt")?"text/plain":"application/octet-stream";}
   Map<String,String> headers=new HashMap<>();headers.put("X-Content-Type-Options","nosniff");headers.put("Cache-Control","no-store");headers.put("Content-Security-Policy","default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'none'; frame-src 'none'; base-uri 'none'; form-action 'none'");return new WebResourceResponse(mime,"UTF-8",200,"OK",headers,in);
  }catch(IOException e){return new WebResourceResponse("text/plain","UTF-8",404,"Not Found",Collections.emptyMap(),new ByteArrayInputStream(new byte[0]));}
 }
 @Override public boolean shouldOverrideUrlLoading(WebView view,WebResourceRequest request){return true;}
}
