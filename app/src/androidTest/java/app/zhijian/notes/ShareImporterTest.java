package app.zhijian.notes;

import android.content.Context;
import android.content.ClipData;
import android.content.Intent;
import android.graphics.Bitmap;
import android.net.Uri;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import app.zhijian.notes.data.PaperDb;
import app.zhijian.notes.files.AttachmentStore;
import app.zhijian.notes.files.NoteFileStore;
import app.zhijian.notes.files.ShareImporter;
import java.io.File;
import java.io.FileOutputStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import org.json.JSONArray;
import org.json.JSONObject;
import org.junit.After;
import org.junit.Before;
import org.junit.Test;
import org.junit.runner.RunWith;
import static org.junit.Assert.*;

@RunWith(AndroidJUnit4.class)
public class ShareImporterTest {
 private Context context;private PaperDb db;private AttachmentStore images;private ShareImporter importer;private final List<String> notes=new ArrayList<>();private final List<File> files=new ArrayList<>();
 @Before public void setUp(){context=InstrumentationRegistry.getInstrumentation().getTargetContext();db=new PaperDb(context);images=new AttachmentStore(context);importer=new ShareImporter(context,images,db);}
 @After public void tearDown()throws Exception{for(String id:notes){db.execute("notes.trash",new JSONObject().put("id",id));db.execute("notes.delete",new JSONObject().put("id",id));}db.close();for(File file:files)file.delete();}
 @Test public void textShareCreatesSeparateNotesAndPreservesPlainText()throws Exception{
  Intent intent=new Intent(Intent.ACTION_SEND).setType("text/plain").putExtra(Intent.EXTRA_TEXT,"分享测试首行\n下一行");JSONObject first=importer.importIntent(intent),second=importer.importIntent(intent);notes.add(first.getString("id"));notes.add(second.getString("id"));assertNotEquals(first.getString("id"),second.getString("id"));JSONObject note=db.get("notes",first.getString("id"));assertEquals("分享测试首行",note.getString("title"));assertEquals("分享测试首行\n下一行",note.getString("content"));assertEquals("markdown",note.getString("mode"));
 }
 @Test public void mixedShareCopiesPdfAndImageWhileTheUriPermissionIsAvailable()throws Exception{
  File pdf=new File(context.getCacheDir(),UUID.randomUUID()+".pdf");files.add(pdf);Files.write(pdf.toPath(),"%PDF-1.7\n%%EOF".getBytes(StandardCharsets.UTF_8));Uri pdfUri=source(pdf);
  File png=new File(context.getCacheDir(),UUID.randomUUID()+".png");files.add(png);Bitmap bitmap=Bitmap.createBitmap(2,2,Bitmap.Config.ARGB_8888);try(FileOutputStream out=new FileOutputStream(png)){assertTrue(bitmap.compress(Bitmap.CompressFormat.PNG,100,out));}finally{bitmap.recycle();}Uri pngUri=source(png);
  ArrayList<Uri> streams=new ArrayList<>();streams.add(pdfUri);streams.add(pngUri);Intent intent=new Intent(Intent.ACTION_SEND_MULTIPLE).setType("*/*").putParcelableArrayListExtra(Intent.EXTRA_STREAM,streams).putExtra(Intent.EXTRA_TEXT,"分享的混合资料");JSONObject result=importer.importIntent(intent);notes.add(result.getString("id"));JSONObject note=db.get("notes",result.getString("id"));JSONArray attached=note.getJSONArray("attachments");assertEquals(1,attached.length());assertEquals("application/pdf",attached.getJSONObject(0).getString("mime"));files.add(new File(context.getFilesDir(),attached.getJSONObject(0).getString("src")));assertTrue(files.get(files.size()-1).isFile());String body=note.getString("content");assertTrue(body.startsWith("分享的混合资料\n\n![分享的图片](media/"));String image=body.substring(body.indexOf("media/"),body.lastIndexOf(')'));File copiedImage=new File(context.getFilesDir(),image);files.add(copiedImage);assertTrue(copiedImage.isFile());assertTrue(image.endsWith(".png"));assertNotEquals(png.getAbsolutePath(),copiedImage.getAbsolutePath());
 }
 @Test public void invalidSchemesAndTooManyStreamsFailBeforeCreatingAnything()throws Exception{
  int before=db.snapshot().getJSONArray("notes").length();Intent invalid=new Intent(Intent.ACTION_SEND).setType("application/pdf").putExtra(Intent.EXTRA_STREAM,Uri.parse("file:///private/not-allowed.pdf"));try{importer.importIntent(invalid);fail("file scheme accepted");}catch(java.io.IOException expected){}
  ArrayList<Uri> uris=new ArrayList<>();for(int i=0;i<11;i++)uris.add(Uri.parse("content://example.invalid/"+i));try{importer.importIntent(new Intent(Intent.ACTION_SEND_MULTIPLE).setType("*/*").putParcelableArrayListExtra(Intent.EXTRA_STREAM,uris));fail("11 streams accepted");}catch(java.io.IOException expected){}assertEquals(before,db.snapshot().getJSONArray("notes").length());
 }
 @Test public void plainTextInClipDataIsSavedWhenExtraTextIsAbsent()throws Exception{
  Intent intent=new Intent(Intent.ACTION_SEND).setType("text/plain");intent.setClipData(ClipData.newPlainText("测试片段","剪贴分享测试\n保留第二行"));JSONObject result=importer.importIntent(intent);notes.add(result.getString("id"));JSONObject note=db.get("notes",result.getString("id"));assertEquals("剪贴分享测试",note.getString("title"));assertEquals("剪贴分享测试\n保留第二行",note.getString("content"));
 }
 private Uri source(File source)throws Exception{JSONObject file=new NoteFileStore(context,images).importFile(Uri.fromFile(source));files.add(new File(context.getFilesDir(),file.getString("src")));return NoteFileStore.contentUri(context,file.getString("src"),file.getString("name"));}
}
