package app.zhijian.notes.backup;
import android.content.Context;import app.zhijian.notes.data.PaperDb;
import org.json.*;import java.io.*;import java.util.*;import java.nio.file.Files;
public final class BackupService {
 private final Context context;private final PaperDb db;private final File media;
 public BackupService(Context c,PaperDb db,File media){context=c;this.db=db;this.media=media;}
 public JSONObject snapshot()throws Exception{JSONObject s=db.snapshot(),hashes=new JSONObject();Set<String> refs=new HashSet<>();JSONArray notes=s.getJSONArray("notes");for(int i=0;i<notes.length();i++){JSONObject note=notes.getJSONObject(i);refs.addAll(ArchiveCodec.noteReferences(note));}for(String name:refs){File f=new File(media,name);if(!f.isFile())throw new IOException("有笔记附件缺失，请检查后备份");ArchivePolicy.validateEntry("media/"+name,f.length());hashes.put(name,ArchiveCodec.hash(f));}s.put("media",hashes);return s;}
 public void write(OutputStream out)throws Exception{ArchiveCodec.write(out,snapshot(),media);}
 public JSONObject restore(InputStream in)throws Exception{
  File stage=new File(context.getCacheDir(),"restore-"+UUID.randomUUID());List<File> added=new ArrayList<>();boolean committed=false;
  try{JSONObject incoming=ArchiveCodec.read(in,stage),existing=snapshot();File[] currentFiles=media.listFiles();if(currentFiles!=null)for(File f:currentFiles)if(f.isFile())existing.getJSONObject("media").put(f.getName(),ArchiveCodec.hash(f));JSONObject plan=MergePlanner.plan(existing,incoming),map=plan.getJSONObject("mediaMap");Iterator<String> it=map.keys();while(it.hasNext()){String from=it.next(),to=map.getString(from);File source=new File(stage,"media/"+from),dest=new File(media,to);if(dest.exists()){if(!ArchiveCodec.hash(dest).equals(ArchiveCodec.hash(source)))throw new IOException("附件冲突，请重试恢复");continue;}added.add(dest);try(InputStream f=new FileInputStream(source);OutputStream o=new FileOutputStream(dest)){byte[] b=new byte[16384];int n;while((n=f.read(b))!=-1)o.write(b,0,n);}}
   db.applySnapshot(plan);committed=true;return plan.getJSONObject("importResult");
  }finally{if(!committed)for(File f:added)f.delete();deleteStage(stage,context.getCacheDir());}
 }
 private static void deleteStage(File file,File allowed)throws IOException{if(!file.getCanonicalPath().startsWith(allowed.getCanonicalPath()+File.separator))throw new IOException("暂存路径无效");File[] children=file.listFiles();if(children!=null)for(File child:children)deleteStage(child,allowed);file.delete();}
}
