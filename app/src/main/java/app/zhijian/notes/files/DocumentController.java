package app.zhijian.notes.files;
import android.app.Activity;import android.content.Intent;import android.net.Uri;
import org.json.*;import java.io.*;import java.text.SimpleDateFormat;import java.util.*;
import app.zhijian.notes.backup.*;
import app.zhijian.notes.bridge.NativeBridge;
public final class DocumentController {
 private static final int REQUEST=1901;private final Activity activity;private final NativeBridge bridge;private final AttachmentStore attachments;private final BackupService backup;
 private String requestId,method;private JSONObject args;
 public DocumentController(Activity a,NativeBridge b,AttachmentStore files,BackupService backups){activity=a;bridge=b;attachments=files;backup=backups;}
 public void start(String id,String command,JSONObject payload){activity.runOnUiThread(()->{
  if(requestId!=null){bridge.reject(id,new IllegalStateException("请先完成当前文件选择"));return;}
  requestId=id;method=command;args=payload;
  try{Intent i;
   if(command.equals("attachments.pick")){i=new Intent(Intent.ACTION_OPEN_DOCUMENT).setType("image/*").addCategory(Intent.CATEGORY_OPENABLE);}
   else if(command.equals("attachments.pickFile")){i=new Intent(Intent.ACTION_OPEN_DOCUMENT).setType("*/*").addCategory(Intent.CATEGORY_OPENABLE);}
   else if(command.equals("backup.import")){i=new Intent(Intent.ACTION_OPEN_DOCUMENT).setType("*/*").addCategory(Intent.CATEGORY_OPENABLE);i.putExtra(Intent.EXTRA_MIME_TYPES,new String[]{"application/zip","application/octet-stream","application/x-zip-compressed"});}
   else{i=new Intent(Intent.ACTION_CREATE_DOCUMENT).setType("application/zip").addCategory(Intent.CATEGORY_OPENABLE);String stamp=new SimpleDateFormat("yyyyMMdd-HHmmss",Locale.ROOT).format(new Date());i.putExtra(Intent.EXTRA_TITLE,(command.equals("backup.export")?"纸间备份-":"纸间Markdown-")+stamp+".zip");}
   activity.startActivityForResult(i,REQUEST);
  }catch(Exception e){requestId=null;bridge.reject(id,e);}
 });}
 public boolean result(int request,int code,Intent data){if(request!=REQUEST)return false;if(requestId==null)return true;String id=requestId,command=method;JSONObject payload=args;requestId=null;if(code!=Activity.RESULT_OK||data==null||data.getData()==null){bridge.resolve(id,new JSONObject());return true;}Uri uri=data.getData();
  bridge.background(()->{try{JSONObject result;
   if(command.equals("attachments.pick"))result=attachments.importImage(uri);
   else if(command.equals("attachments.pickFile"))result=new NoteFileStore(activity,attachments).importFile(uri);
   else if(command.equals("backup.import")){try(InputStream in=activity.getContentResolver().openInputStream(uri)){if(in==null)throw new IOException("无法读取备份");result=backup.restore(in);}bridge.refreshReminders();result.put("success",true);}
   else{try(OutputStream out=activity.getContentResolver().openOutputStream(uri,"wt")){if(out==null)throw new IOException("无法写入所选位置");if(command.equals("backup.export"))backup.write(out);else MarkdownExport.write(out,payload.getJSONArray("notes"),attachments.directory);}result=new JSONObject().put("success",true);if(command.equals("backup.export"))activity.getSharedPreferences("paper",0).edit().putLong("lastBackup",System.currentTimeMillis()).apply();}
   bridge.resolve(id,result);
  }catch(Exception e){bridge.reject(id,e);}});return true;
 }
}
