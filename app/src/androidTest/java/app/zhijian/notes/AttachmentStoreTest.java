package app.zhijian.notes;

import android.content.Context;
import android.content.ContextWrapper;
import android.graphics.Bitmap;
import android.net.Uri;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import app.zhijian.notes.files.AttachmentStore;
import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileOutputStream;
import java.io.OutputStream;
import java.io.RandomAccessFile;
import java.nio.file.Files;
import java.util.Arrays;
import java.util.Base64;
import java.util.zip.CRC32;
import org.json.JSONArray;
import org.json.JSONObject;
import org.junit.After;
import org.junit.Before;
import org.junit.Test;
import org.junit.runner.RunWith;
import static org.junit.Assert.*;

@RunWith(AndroidJUnit4.class)
public class AttachmentStoreTest {
 private File root;
 private Context context;
 private AttachmentStore store;

 @Before public void setUp() throws Exception {
  Context target=InstrumentationRegistry.getInstrumentation().getTargetContext();
  root=File.createTempFile("attachment-test-","",target.getCacheDir());
  assertTrue(root.delete());assertTrue(root.mkdir());
  File cache=new File(root,"cache");assertTrue(cache.mkdir());
  context=new ContextWrapper(target){
   @Override public File getFilesDir(){return root;}
   @Override public File getCacheDir(){return cache;}
  };
  store=new AttachmentStore(context);
 }

 @After public void tearDown(){deleteTree(root);}

 @Test public void pendingImportSurvivesPruneUntilReferencedThenCanBeCollected() throws Exception {
  File source=new File(context.getCacheDir(),"original.png");
  Bitmap bitmap=Bitmap.createBitmap(2,2,Bitmap.Config.ARGB_8888);
  try(OutputStream out=new FileOutputStream(source)){assertTrue(bitmap.compress(Bitmap.CompressFormat.PNG,100,out));}
  bitmap.recycle();
  JSONObject saved=store.importImage(Uri.fromFile(source));
  File imported=new File(root,saved.getString("src"));
  store.prune(emptySnapshot(),null);
  assertTrue("An editor image must survive before the note or draft references it",imported.isFile());
  JSONObject note=new JSONObject().put("mode","markdown").put("content","![image]("+saved.getString("src")+")");
  store.prune(new JSONObject().put("notes",new JSONArray().put(note)),null);
  assertTrue(imported.isFile());
  store.prune(emptySnapshot(),null);
  assertFalse("An adopted image should be collected after its note reference is removed",imported.exists());
 }

 @Test public void savesPngToNewPrivateFileWithoutChangingOriginal() throws Exception {
  byte[] original=png();
  File source=new File(context.getCacheDir(),"original.png");Files.write(source.toPath(),original);
  String originalSrc=store.importImage(Uri.fromFile(source)).getString("src");
  JSONObject saved=store.saveImage(dataUrl(original));
  String src=saved.getString("src");
  assertTrue(src.matches("media/[0-9a-f-]{36}\\.png"));
  assertNotEquals(originalSrc,src);
  assertArrayEquals(original,Files.readAllBytes(new File(root,src).toPath()));
  assertArrayEquals(original,Files.readAllBytes(new File(root,originalSrc).toPath()));
  assertArrayEquals(original,Files.readAllBytes(source.toPath()));
  assertEquals(2,store.directory.list().length);
  for(String name:store.directory.list())assertTrue(name.endsWith(".png"));
 }

 @Test public void rejectsExternalPathsWrongMimeMalformedBase64AndInvalidPngWithoutFiles() throws Exception {
  String valid=dataUrl(png());
  for(String invalid:new String[]{null,"","https://example.test/image.png","media/original.png","data:image/jpeg;base64,"+valid.substring(valid.indexOf(',')+1),"data:image/png;base64,%%%%","data:image/png;base64,AA\nAA","data:image/png;base64,","data:image/png;base64,AQIDBA==",dataUrl(Arrays.copyOf(png(),33))}){
   assertRejected(invalid);assertEquals(0,store.directory.list().length);
  }
  Bitmap bitmap=Bitmap.createBitmap(2,2,Bitmap.Config.ARGB_8888);ByteArrayOutputStream jpeg=new ByteArrayOutputStream();
  assertTrue(bitmap.compress(Bitmap.CompressFormat.JPEG,100,jpeg));bitmap.recycle();
  assertRejected(dataUrl(jpeg.toByteArray()));assertEquals(0,store.directory.list().length);
 }

 @Test public void rejectsOversizedPngPayloadBeforePersistingIt() throws Exception {
  char[] oversized=new char[27962032];Arrays.fill(oversized,'A');
  assertRejected("data:image/png;base64,"+new String(oversized));
  assertEquals(0,store.directory.list().length);
 }

 @Test public void decodedByteLimitRejectsValidPngEvenWithinBase64LengthCeiling() throws Exception {
  byte[] oversized=Arrays.copyOf(png(),20971521);
  assertRejected(dataUrl(oversized));assertEquals(0,store.directory.list().length);
 }

 @Test public void rejectsExcessiveImageDimensionsWithoutLeavingTempFiles() throws Exception {
  assertRejected(dataUrl(pngWithDimensions(7000,6000)));
  assertRejected(dataUrl(pngWithDimensions(20000,1)));
  assertEquals(0,store.directory.list().length);
 }

 @Test public void failedImageImportLeavesNoPartialFiles() throws Exception {
  File source=new File(context.getCacheDir(),"invalid.png");Files.write(source.toPath(),new byte[]{1,2,3,4});
  try{store.importImage(Uri.fromFile(source));fail("Invalid image accepted");}catch(java.io.IOException expected){}
  assertEquals(0,store.directory.list().length);
  try(RandomAccessFile large=new RandomAccessFile(source,"rw")){large.setLength(20971521L);}
  try{store.importImage(Uri.fromFile(source));fail("Oversized image accepted");}catch(java.io.IOException expected){}
  assertEquals(0,store.directory.list().length);
 }

 @Test public void pendingSavedImageIsAdoptedByDraftAndCanLaterBeCollected() throws Exception {
  String src=store.saveImage(dataUrl(png())).getString("src");File saved=new File(root,src);
  store.prune(emptySnapshot(),null);assertTrue(saved.isFile());
  store.prune(emptySnapshot(),new JSONObject().put("mode","rich").put("content","<p><img src=\""+src+"\"></p>"));
  assertTrue(saved.isFile());
  store.prune(emptySnapshot(),null);assertFalse(saved.exists());
 }

 @Test public void abandonedPendingImagesAreCollectedInNextStoreSession() throws Exception {
  String src=store.saveImage(dataUrl(png())).getString("src");
  store.prune(emptySnapshot(),null);assertTrue(new File(root,src).isFile());
  new AttachmentStore(context).prune(emptySnapshot(),null);assertFalse(new File(root,src).exists());
 }

 private void assertRejected(String dataUrl) throws Exception {
  try{store.saveImage(dataUrl);fail("Invalid PNG data URL accepted");}catch(java.io.IOException|IllegalArgumentException expected){}
 }
 private byte[] png() throws Exception {
  Bitmap bitmap=Bitmap.createBitmap(2,2,Bitmap.Config.ARGB_8888);ByteArrayOutputStream out=new ByteArrayOutputStream();
  try{assertTrue(bitmap.compress(Bitmap.CompressFormat.PNG,100,out));return out.toByteArray();}finally{bitmap.recycle();}
 }
 private String dataUrl(byte[] bytes){return "data:image/png;base64,"+Base64.getEncoder().encodeToString(bytes);}
 private byte[] pngWithDimensions(int width,int height) throws Exception {
  byte[] bytes=png();putInt(bytes,16,width);putInt(bytes,20,height);
  CRC32 crc=new CRC32();crc.update(bytes,12,17);putInt(bytes,29,(int)crc.getValue());return bytes;
 }
 private void putInt(byte[] bytes,int offset,int value){for(int i=3;i>=0;i--){bytes[offset+i]=(byte)value;value>>>=8;}}

 private JSONObject emptySnapshot() throws Exception{return new JSONObject().put("notes",new JSONArray());}
 private void deleteTree(File file){if(file==null)return;File[] children=file.listFiles();if(children!=null)for(File child:children)deleteTree(child);file.delete();}
}
