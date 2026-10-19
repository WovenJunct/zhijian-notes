package app.zhijian.notes.files;

import android.app.Activity;
import android.content.ClipData;
import android.content.Context;
import android.content.Intent;
import android.database.Cursor;
import android.net.Uri;
import android.provider.OpenableColumns;
import app.zhijian.notes.backup.ArchivePolicy;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.Locale;
import java.util.UUID;
import org.json.JSONObject;

/** Copies ordinary files privately. Binaries are never served to the WebView. */
public final class NoteFileStore {
 public static final String FILE_NAME="[a-fA-F0-9]{8}(?:-[a-fA-F0-9]{4}){3}-[a-fA-F0-9]{12}\\.bin";
 private final Context context;private final AttachmentStore attachments;
 public NoteFileStore(Context context,AttachmentStore attachments){this.context=context;this.attachments=attachments;}

 public JSONObject importFile(Uri uri)throws Exception{
  if(uri==null||!("content".equals(uri.getScheme())||"file".equals(uri.getScheme())))throw new IOException("无法读取所选附件");
  String name=displayName(context,uri),declared=context.getContentResolver().getType(uri);
  File temp=File.createTempFile("file-",".tmp",attachments.directory);
  try{
   long size=0;
   try(InputStream in=context.getContentResolver().openInputStream(uri);FileOutputStream out=new FileOutputStream(temp)){
    if(in==null)throw new IOException("无法读取所选附件");byte[] buffer=new byte[16384];int count;
    while((count=in.read(buffer))!=-1){size+=count;if(size>ArchivePolicy.MAX_IMAGE)throw new IOException("每个附件请小于 20 MB");out.write(buffer,0,count);}out.getFD().sync();
   }
   String mime=mime(temp,name,declared);String filename;File destination;
   do{filename=UUID.randomUUID()+".bin";destination=new File(attachments.directory,filename);}while(destination.exists());
   JSONObject result=new JSONObject().put("src","media/"+filename).put("name",name).put("mime",mime).put("size",size);
   // Share the same lock as pruning, so a newly published file is never untracked.
   synchronized(attachments){if(!temp.renameTo(destination))throw new IOException("附件保存失败，请检查可用空间后重试");attachments.trackPending(filename);}
   return result;
  }finally{temp.delete();}
 }

 public static void open(Activity activity,JSONObject args)throws Exception{
  String src=args.getString("src"),name=safeName(args.optString("name","附件"));File file=resolve(activity,src.substring(src.startsWith("media/")?6:0));
  // Ignore untrusted MIME supplied by JavaScript or an imported note.
  String type=mime(file,name,null);Uri uri=contentUri(activity,src,name);
  Intent intent=new Intent(Intent.ACTION_VIEW).setDataAndType(uri,type).addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);intent.setClipData(ClipData.newRawUri(name,uri));
  try{activity.startActivity(intent);}catch(android.content.ActivityNotFoundException e){throw new IOException("没有可打开此附件的应用，请安装相应的本地阅读器");}
 }
 public static Uri contentUri(Context context,String src,String name){
  if(src==null||!src.matches("media/"+FILE_NAME))throw new IllegalArgumentException("附件引用无效");
  return new Uri.Builder().scheme("content").authority(context.getPackageName()+".files").appendPath("attachments").appendPath(src.substring(6)).appendPath(safeName(name)).build();
 }
 static File resolve(Context context,String filename)throws IOException{
  if(filename==null||!filename.matches(FILE_NAME))throw new IOException("附件引用无效");File directory=new File(context.getFilesDir(),"media").getCanonicalFile(),file=new File(directory,filename).getCanonicalFile();
  if(!directory.equals(file.getParentFile())||!file.isFile()||file.length()>ArchivePolicy.MAX_IMAGE)throw new IOException("附件不存在或无法读取");return file;
 }
 static String safeName(String name){
  String value=(name==null?"":name).replaceAll("[\\p{Cntrl}\\u202a-\\u202e\\u2066-\\u2069]","").replace('/','_').replace('\\','_').trim();
  if(value.isEmpty()||value.equals(".")||value.equals(".."))value="附件";
  if(value.length()>180){int dot=value.lastIndexOf('.');String extension=dot>=0&&value.length()-dot<=16?value.substring(dot):"";int end=180-extension.length();if(Character.isHighSurrogate(value.charAt(end-1)))end--;value=value.substring(0,end)+extension;}
  return value;
 }
 private static String displayName(Context context,Uri uri){
  String name=null;
  try(Cursor cursor=context.getContentResolver().query(uri,new String[]{OpenableColumns.DISPLAY_NAME,OpenableColumns.SIZE},null,null,null)){
   if(cursor!=null&&cursor.moveToFirst()){int column=cursor.getColumnIndex(OpenableColumns.DISPLAY_NAME);if(column>=0)name=cursor.getString(column);}
  }catch(RuntimeException ignored){}
  return safeName(name==null?uri.getLastPathSegment():name);
 }
 static String mime(File file,String name,String declared)throws IOException{
  byte[] bytes=new byte[512];int length;
  try(InputStream in=new FileInputStream(file)){length=in.read(bytes);}
  String head=new String(bytes,0,Math.max(length,0),StandardCharsets.ISO_8859_1),lower=name.toLowerCase(Locale.ROOT);
  if(head.startsWith("%PDF-"))return "application/pdf";
  if(lower.endsWith(".pdf")||"application/pdf".equalsIgnoreCase(declared))throw new IOException("PDF 内容无效，请重新选择文件");
  if(length>=8&&(bytes[0]&255)==137&&head.startsWith("PNG\r\n\u001a\n",1))return "image/png";
  if(length>=3&&(bytes[0]&255)==255&&(bytes[1]&255)==216&&(bytes[2]&255)==255)return "image/jpeg";
  if(head.startsWith("GIF87a")||head.startsWith("GIF89a"))return "image/gif";
  if(length>=12&&head.startsWith("RIFF")&&head.startsWith("WEBP",8))return "image/webp";
  if(head.startsWith("PK\003\004")||head.startsWith("PK\005\006")){
   if(lower.endsWith(".docx"))return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
   if(lower.endsWith(".xlsx"))return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
   if(lower.endsWith(".pptx"))return "application/vnd.openxmlformats-officedocument.presentationml.presentation";
   if(lower.endsWith(".odt"))return "application/vnd.oasis.opendocument.text";if(lower.endsWith(".ods"))return "application/vnd.oasis.opendocument.spreadsheet";
   return "application/zip";
  }
  // Active text is kept as a download, never advertised as executable web content.
  if(lower.matches(".*\\.(html?|xhtml|svg|xml|js|mjs|css)$"))return "application/octet-stream";
  if((lower.matches(".*\\.(txt|md|csv|log)$")||"text/plain".equalsIgnoreCase(declared))&&!head.contains("\u0000"))return "text/plain";
  return "application/octet-stream";
 }
}
