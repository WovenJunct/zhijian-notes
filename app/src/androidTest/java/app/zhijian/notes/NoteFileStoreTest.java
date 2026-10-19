package app.zhijian.notes;

import android.content.Context;
import android.content.ContextWrapper;
import android.content.pm.ProviderInfo;
import android.database.Cursor;
import android.net.Uri;
import android.os.ParcelFileDescriptor;
import android.provider.OpenableColumns;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import app.zhijian.notes.files.AttachmentStore;
import app.zhijian.notes.files.NoteFileProvider;
import app.zhijian.notes.files.NoteFileStore;
import java.io.File;
import java.io.RandomAccessFile;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import org.json.JSONArray;
import org.json.JSONObject;
import org.junit.After;
import org.junit.Before;
import org.junit.Test;
import org.junit.runner.RunWith;
import static org.junit.Assert.*;

@RunWith(AndroidJUnit4.class)
public class NoteFileStoreTest {
 private File root;private Context context;private AttachmentStore attachments;private NoteFileStore store;private NoteFileProvider provider;
 @Before public void setUp()throws Exception{
  Context target=InstrumentationRegistry.getInstrumentation().getTargetContext();root=File.createTempFile("note-files-test-","",target.getCacheDir());assertTrue(root.delete());assertTrue(root.mkdir());
  context=new ContextWrapper(target){@Override public File getFilesDir(){return root;}};attachments=new AttachmentStore(context);store=new NoteFileStore(context,attachments);provider=new NoteFileProvider();ProviderInfo info=new ProviderInfo();info.authority=context.getPackageName()+".files";info.exported=false;info.grantUriPermissions=true;provider.attachInfo(context,info);
 }
 @After public void tearDown(){delete(root);}
 @Test public void importsPdfAtomicallyAndPendingFilesSurviveBeforeNoteSave()throws Exception{
  File source=new File(root,"资料.pdf");byte[] bytes="%PDF-1.7\n1 0 obj<<>>endobj\n%%EOF".getBytes(StandardCharsets.UTF_8);Files.write(source.toPath(),bytes);JSONObject file=store.importFile(Uri.fromFile(source));assertTrue(file.getString("src").matches("media/[a-f0-9-]{36}\\.bin"));assertEquals("资料.pdf",file.getString("name"));assertEquals("application/pdf",file.getString("mime"));assertEquals(bytes.length,file.getLong("size"));assertArrayEquals(bytes,Files.readAllBytes(new File(root,file.getString("src")).toPath()));attachments.prune(new JSONObject().put("notes",new JSONArray()),null);assertTrue(new File(root,file.getString("src")).exists());assertArrayEquals(bytes,Files.readAllBytes(source.toPath()));
 }
 @Test public void providerReturnsOnlyNameSizeMimeAndReadOnlyBytes()throws Exception{
  File source=new File(root,"sample.pdf");Files.write(source.toPath(),"%PDF-1.4\n%%EOF".getBytes(StandardCharsets.UTF_8));JSONObject file=store.importFile(Uri.fromFile(source));Uri uri=NoteFileStore.contentUri(context,file.getString("src"),file.getString("name"));assertEquals("application/pdf",provider.getType(uri));
  try(Cursor c=provider.query(uri,new String[]{OpenableColumns.DISPLAY_NAME,OpenableColumns.SIZE,"_data"},null,null,null)){assertTrue(c.moveToFirst());assertEquals("sample.pdf",c.getString(0));assertEquals(file.getLong("size"),c.getLong(1));assertTrue(c.isNull(2));}
  try(ParcelFileDescriptor p=provider.openFile(uri,"r")){assertEquals(file.getLong("size"),p.getStatSize());}
  try{provider.openFile(uri,"rw");fail("Writable open accepted");}catch(SecurityException expected){}
 }
 @Test public void rejectsBadPathsAndMislabeledPdfWithoutPublishingFiles()throws Exception{
  for(String src:new String[]{"../private.bin","media/../private.bin","media/not-a-uuid.bin","media/12345678-1234-4234-9234-123456789abc.png","https://outside.invalid/private.bin"})try{NoteFileStore.contentUri(context,src,"test.pdf");fail("Bad source accepted");}catch(IllegalArgumentException expected){}
  Uri unknown=Uri.parse("content://"+context.getPackageName()+".files/attachments/../../private.bin/test.pdf");try{provider.openFile(unknown,"r");fail("Traversal accepted");}catch(java.io.FileNotFoundException|IllegalArgumentException expected){}
  File source=new File(root,"pretend.pdf");Files.write(source.toPath(),"<html>not a PDF</html>".getBytes(StandardCharsets.UTF_8));try{store.importFile(Uri.fromFile(source));fail("Mislabeled PDF accepted");}catch(java.io.IOException expected){}assertEquals(0,attachments.directory.list().length);
 }
 @Test public void oversizedFileFailsWithoutPartialMediaAndActiveTextIsOctetStream()throws Exception{
  File source=new File(root,"large.bin");try(RandomAccessFile f=new RandomAccessFile(source,"rw")){f.setLength(20L*1024*1024+1);}try{store.importFile(Uri.fromFile(source));fail("Oversized file accepted");}catch(java.io.IOException expected){}assertEquals(0,attachments.directory.list().length);
  source=new File(root,"script.html");Files.write(source.toPath(),"<html><script>unsafe()</script></html>".getBytes(StandardCharsets.UTF_8));JSONObject file=store.importFile(Uri.fromFile(source));assertEquals("application/octet-stream",file.getString("mime"));assertFalse(file.getString("name").contains("/"));
 }
 @Test public void providerRejectsCanonicalSymlinkEscape()throws Exception{
  File outside=new File(root,"private.txt");Files.write(outside.toPath(),"private test fixture".getBytes(StandardCharsets.UTF_8));String filename="12345678-1234-4234-9234-123456789abc.bin";Files.createSymbolicLink(new File(attachments.directory,filename).toPath(),outside.toPath());Uri uri=NoteFileStore.contentUri(context,"media/"+filename,"fixture.txt");try{provider.openFile(uri,"r");fail("Canonical escape accepted");}catch(java.io.FileNotFoundException expected){}
 }
 private void delete(File f){if(f==null)return;File[] children=f.listFiles();if(children!=null)for(File child:children)delete(child);f.delete();}
}
