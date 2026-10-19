package app.zhijian.notes.files;

import android.content.Context;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.net.Uri;
import app.zhijian.notes.backup.ArchiveCodec;
import app.zhijian.notes.backup.ArchivePolicy;
import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.util.Base64;
import java.util.HashSet;
import java.util.Set;
import java.util.UUID;
import org.json.JSONArray;
import org.json.JSONObject;

public final class AttachmentStore {
 private static final String PNG_PREFIX="data:image/png;base64,";
 private static final long MAX_PIXELS=40000000L;
 private static final int MAX_SIDE=16384;
 private final Context context;
 private final Set<String> pending=new HashSet<>();
 public final File directory;

 public AttachmentStore(Context c){
  context=c;directory=new File(c.getFilesDir(),"media");
  if(!directory.isDirectory()&&!directory.mkdirs())throw new IllegalStateException("无法创建图片目录");
 }

 public synchronized void prune(JSONObject snapshot,JSONObject draft)throws Exception {
  Set<String> keep=new HashSet<>();JSONArray notes=snapshot.getJSONArray("notes");
  for(int i=0;i<notes.length();i++)keep.addAll(ArchiveCodec.noteReferences(notes.getJSONObject(i)));
  if(draft!=null)keep.addAll(ArchiveCodec.noteReferences(draft));
  // References adopt pending files. Images still in an open editor survive this session.
  pending.removeAll(keep);keep.addAll(pending);
  File[] files=directory.listFiles();
  if(files!=null)for(File file:files)if(file.isFile()&&!keep.contains(file.getName()))file.delete();
 }
 public synchronized void trackPending(String filename){if(!filename.matches("[a-zA-Z0-9_-]+\\.(png|jpg|jpeg|webp|gif|bin)"))throw new IllegalArgumentException("附件文件名无效");pending.add(filename);}

 public synchronized JSONObject importImage(Uri uri)throws Exception {
  File temp=File.createTempFile("image-",".tmp",directory);
  try{
   try(InputStream in=context.getContentResolver().openInputStream(uri);FileOutputStream out=new FileOutputStream(temp)){
    if(in==null)throw new IOException("无法读取图片");
    byte[] buffer=new byte[16384];long size=0;int count;
    while((count=in.read(buffer))!=-1){size+=count;if(size>ArchivePolicy.MAX_IMAGE)throw new IOException("图片请小于 20 MB");out.write(buffer,0,count);}
    out.getFD().sync();
   }
   return publish(temp,validateImage(temp,false));
  }finally{temp.delete();}
 }

 public synchronized JSONObject saveImage(String dataUrl)throws Exception {
  if(dataUrl==null||!dataUrl.startsWith(PNG_PREFIX))throw new IllegalArgumentException("请保存 PNG 图片数据");
  int encodedLength=dataUrl.length()-PNG_PREFIX.length();
  if(encodedLength>4*((ArchivePolicy.MAX_IMAGE+2)/3))throw new IllegalArgumentException("图片请小于 20 MB");
  byte[] bytes;
  try{bytes=Base64.getDecoder().decode(dataUrl.substring(PNG_PREFIX.length()));}
  catch(IllegalArgumentException invalid){throw new IllegalArgumentException("PNG 图片数据无效");}
  if(bytes.length==0||bytes.length>ArchivePolicy.MAX_IMAGE)throw new IllegalArgumentException("PNG 图片大小无效，请小于 20 MB");
  File temp=File.createTempFile("image-",".tmp",directory);
  try{
   try(FileOutputStream out=new FileOutputStream(temp)){out.write(bytes);out.getFD().sync();}
   validateImage(temp,true);
   return publish(temp,"png");
  }finally{temp.delete();}
 }

 private String validateImage(File file,boolean pngOnly)throws IOException {
  BitmapFactory.Options bounds=new BitmapFactory.Options();bounds.inJustDecodeBounds=true;
  BitmapFactory.decodeFile(file.getPath(),bounds);String mime=bounds.outMimeType;
  String extension="image/jpeg".equals(mime)?"jpg":"image/png".equals(mime)?"png":"image/webp".equals(mime)?"webp":"image/gif".equals(mime)?"gif":null;
  if(extension==null||bounds.outWidth<=0||bounds.outHeight<=0||pngOnly&&!"png".equals(extension))throw new IOException(pngOnly?"PNG 图片数据无效":"请选择 JPG、PNG、WebP 或 GIF 图片");
  if(bounds.outWidth>MAX_SIDE||bounds.outHeight>MAX_SIDE||(long)bounds.outWidth*bounds.outHeight>MAX_PIXELS)throw new IOException("图片尺寸过大，请缩小后插入");
  if(pngOnly){
   BitmapFactory.Options sampled=new BitmapFactory.Options();sampled.inSampleSize=1;
   while(bounds.outWidth/sampled.inSampleSize>1024||bounds.outHeight/sampled.inSampleSize>1024)sampled.inSampleSize*=2;
   Bitmap decoded=BitmapFactory.decodeFile(file.getPath(),sampled);
   if(decoded==null)throw new IOException("PNG 图片数据无效");
   decoded.recycle();
  }
  return extension;
 }

 private JSONObject publish(File temp,String extension)throws Exception {
  String name;File destination;
  do{name=UUID.randomUUID()+"."+extension;destination=new File(directory,name);}while(destination.exists());
  JSONObject result=new JSONObject().put("src","media/"+name);
  // Both paths are in media: a failed rename cannot expose a partial destination.
  if(!temp.renameTo(destination))throw new IOException("图片保存失败，请检查可用空间后重试");
  pending.add(name);return result;
 }
}
