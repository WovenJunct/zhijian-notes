package app.zhijian.notes.files;

import android.content.ClipData;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import app.zhijian.notes.data.PaperDb;
import java.io.File;
import java.io.IOException;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import org.json.JSONArray;
import org.json.JSONObject;

/** Run on the bridge worker while the incoming temporary URI grants are valid. */
public final class ShareImporter {
 private final Context context;private final AttachmentStore images;private final PaperDb db;
 public ShareImporter(Context context,AttachmentStore images,PaperDb db){this.context=context;this.images=images;this.db=db;}

 @SuppressWarnings("deprecation")
 public JSONObject importIntent(Intent intent)throws Exception{
  if(intent==null||!(Intent.ACTION_SEND.equals(intent.getAction())||Intent.ACTION_SEND_MULTIPLE.equals(intent.getAction())))throw new IllegalArgumentException("不支持的分享内容");
  CharSequence shared=intent.getCharSequenceExtra(Intent.EXTRA_TEXT);String text=shared==null?"":shared.toString();if(text.length()>2*1024*1024)throw new IOException("分享文字过长，请分成多条笔记");
  Set<Uri> uris=new LinkedHashSet<>();
  if(Intent.ACTION_SEND.equals(intent.getAction())){Object value=intent.getParcelableExtra(Intent.EXTRA_STREAM);if(value!=null){if(!(value instanceof Uri))throw new IOException("分享附件地址无效");uris.add((Uri)value);}}
  else{ArrayList<?> values=intent.getParcelableArrayListExtra(Intent.EXTRA_STREAM);if(values!=null)for(Object value:values){if(!(value instanceof Uri))throw new IOException("分享附件地址无效");uris.add((Uri)value);}}
  ClipData clip=intent.getClipData();StringBuilder clipText=new StringBuilder();if(clip!=null)for(int i=0;i<clip.getItemCount();i++){ClipData.Item item=clip.getItemAt(i);Uri uri=item.getUri();if(uri!=null)uris.add(uri);else if(shared==null&&item.getText()!=null){if(clipText.length()>0)clipText.append('\n');if(clipText.length()+item.getText().length()>2*1024*1024)throw new IOException("分享文字过长，请分成多条笔记");clipText.append(item.getText());}}
  if(shared==null)text=clipText.toString();if(uris.isEmpty()&&intent.getData()!=null&&"content".equals(intent.getData().getScheme()))uris.add(intent.getData());
  if(uris.size()>10)throw new IOException("一次最多分享 10 个附件");
  for(Uri uri:uris)if(!"content".equals(uri.getScheme())||uri.getAuthority()==null||uri.getAuthority().isEmpty())throw new IOException("分享附件必须由系统文件提供器读取");
  String subject=intent.getStringExtra(Intent.EXTRA_SUBJECT);if(uris.isEmpty()&&text.trim().isEmpty()&&(subject==null||subject.trim().isEmpty()))throw new IOException("没有可保存的分享内容");
  NoteFileStore files=new NoteFileStore(context,images);List<File> copied=new ArrayList<>();JSONArray attached=new JSONArray();StringBuilder content=new StringBuilder(text);long total=0;int pictureCount=0;String firstName=null;
  try{
   for(Uri uri:uris){
    // Copy once while permission is alive, then classify by the private bytes.
    JSONObject file=files.importFile(uri);File binary=new File(context.getFilesDir(),file.getString("src"));copied.add(binary);total+=file.getLong("size");if(total>200L*1024*1024)throw new IOException("分享附件合计请小于 200 MB");
    if(firstName==null)firstName=file.getString("name");String type=file.getString("mime");
    if(type.equals("image/png")||type.equals("image/jpeg")||type.equals("image/webp")||type.equals("image/gif")){
     JSONObject picture=images.importImage(Uri.fromFile(binary));copied.add(new File(context.getFilesDir(),picture.getString("src")));if(!binary.delete())throw new IOException("无法整理分享的临时图片");
     if(content.length()>0)content.append("\n\n");content.append("![分享的图片](").append(picture.getString("src")).append(')');pictureCount++;
    }else attached.put(file);
   }
   if(content.length()>2*1024*1024)throw new IOException("分享内容过长，请分成多条笔记");
   String title=subject==null?"":subject.trim();if(title.isEmpty()){for(String line:text.split("\\R",-1))if(!line.trim().isEmpty()){title=line.trim();break;}}
   if(title.isEmpty())title=pictureCount>0&&attached.length()==0?"分享的图片":firstName==null?"分享内容":firstName;title=title.replaceAll("[\\p{Cntrl}\\u202a-\\u202e\\u2066-\\u2069]","");
   if(title.length()>300){int end=Character.isHighSurrogate(title.charAt(299))?299:300;title=title.substring(0,end);}if(title.isEmpty())title="分享内容";
   JSONObject note=db.save("notes",new JSONObject().put("title",title).put("mode","markdown").put("content",content.toString()).put("plainText",text).put("tags",new JSONArray()).put("attachments",attached));
   return new JSONObject().put("id",note.getString("id"));
  }catch(Exception error){synchronized(images){for(File file:copied)file.delete();}throw error;}
 }
}
