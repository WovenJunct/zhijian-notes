package app.zhijian.notes;
import androidx.test.ext.junit.runners.AndroidJUnit4;import androidx.test.platform.app.InstrumentationRegistry;
import android.content.Context;import android.net.Uri;import android.graphics.Bitmap;
import app.zhijian.notes.data.PaperDb;import app.zhijian.notes.backup.*;import app.zhijian.notes.files.AttachmentStore;
import org.json.*;import org.junit.Test;import org.junit.runner.RunWith;import static org.junit.Assert.*;import java.io.*;
@RunWith(AndroidJUnit4.class) public class BackupIntegrationTest {
 @Test public void realDatabaseBackupConflictRecoveryAndImageCleanup()throws Exception{
  Context c=InstrumentationRegistry.getInstrumentation().getTargetContext();PaperDb db=new PaperDb(c);JSONObject original=db.snapshot();AttachmentStore store=new AttachmentStore(c);File source=File.createTempFile("photo-",".png",c.getCacheDir());String imported=null;
  try{Bitmap bmp=Bitmap.createBitmap(2,2,Bitmap.Config.ARGB_8888);try(OutputStream out=new FileOutputStream(source)){bmp.compress(Bitmap.CompressFormat.PNG,100,out);}bmp.recycle();JSONObject image=store.importImage(Uri.fromFile(source));imported=image.getString("src").substring(6);JSONObject n=db.save("notes",new JSONObject().put("title","备份原生测试").put("content","![图片]("+image.getString("src")+")\n原始文字").put("plainText","原始文字").put("mode","markdown").put("tags",new JSONArray().put("备份测试")));
   store.prune(db.snapshot(),null);
   BackupService service=new BackupService(c,db,store.directory);ByteArrayOutputStream zip=new ByteArrayOutputStream();service.write(zip);n.put("content","本地修改").put("plainText","本地修改");db.save("notes",n);JSONObject result=service.restore(new ByteArrayInputStream(zip.toByteArray()));assertTrue(result.getInt("conflicts")>=1);assertEquals(2,db.execute("notes.list",new JSONObject().put("search","备份原生测试")).getInt("total"));service.restore(new ByteArrayInputStream(zip.toByteArray()));assertEquals(2,db.execute("notes.list",new JSONObject().put("search","备份原生测试")).getInt("total"));assertTrue(new File(store.directory,imported).isFile());
   String before=MergePlanner.canonical(db.snapshot());try{service.restore(new ByteArrayInputStream(new byte[]{1,2,3}));fail();}catch(IOException|IllegalArgumentException|JSONException expected){}assertEquals(before,MergePlanner.canonical(db.snapshot()));
   db.applySnapshot(original);store.prune(original,null);assertFalse(new File(store.directory,imported).exists());
  }finally{db.applySnapshot(original);if(imported!=null)new File(store.directory,imported).delete();source.delete();db.close();}
 }
}
