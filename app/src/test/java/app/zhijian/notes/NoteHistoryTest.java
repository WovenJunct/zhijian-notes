package app.zhijian.notes;
import app.zhijian.notes.data.NoteHistory;
import org.json.*;
import org.junit.Test;
import java.nio.charset.StandardCharsets;
import static org.junit.Assert.*;
public class NoteHistoryTest {
 private JSONObject note(String content,long updated)throws Exception{return new JSONObject().put("id","4ca8e830-e9ce-44af-8916-b879a5e88981").put("title","原来的标题").put("mode","markdown").put("content",content).put("updatedAt",updated).put("tags",new JSONArray().put("保留标签"));}
 @Test public void firstChangeKeepsOriginalAndThrottlesSubsequentAutosaves()throws Exception{
  JSONObject original=note("![](media/original.png)",1),next=note("第二版",1000);
  NoteHistory.beforeSave(next,original,1000);assertEquals("![](media/original.png)",next.getJSONArray("_history").getJSONObject(0).getString("content"));
  JSONObject soon=note("第三版",2000);NoteHistory.beforeSave(soon,next,2000);assertEquals(1,soon.getJSONArray("_history").length());
  JSONObject later=note("第四版",62000);NoteHistory.beforeSave(later,soon,62000);assertEquals(2,later.getJSONArray("_history").length());assertEquals("第三版",later.getJSONArray("_history").getJSONObject(0).getString("content"));
 }
 @Test public void metadataChangesAndStaleClientHistoryNeverAddOrOverwriteVersions()throws Exception{
  JSONObject previous=note("内容",1);NoteHistory.checkpoint(previous,1000);
  JSONObject next=note("内容",2000).put("tags",new JSONArray().put("新标签")).put("_history",new JSONArray());
  NoteHistory.beforeSave(next,previous,62000);assertEquals(1,next.getJSONArray("_history").length());assertEquals("保留标签",previous.getJSONArray("tags").getString(0));
 }
 @Test public void checkpointsBoundCountAndNeverRecursivelyCopyHistory()throws Exception{
  JSONObject n=note("0",1);for(int i=0;i<30;i++){n.put("content",String.valueOf(i));NoteHistory.checkpoint(n,i+1000);}
  JSONArray versions=n.getJSONArray("_history");assertEquals(12,versions.length());assertEquals("29",versions.getJSONObject(0).getString("content"));for(int i=0;i<versions.length();i++){assertFalse(versions.getJSONObject(i).has("_history"));assertFalse(versions.getJSONObject(i).has("tags"));}
 }
 @Test public void utf8HistoryBudgetEvictsOldestButLargeCurrentContentStillSaves()throws Exception{
  JSONObject n=note("中文".repeat(90000),1);NoteHistory.checkpoint(n,1000);n.put("content","另文".repeat(90000));NoteHistory.checkpoint(n,2000);n.put("content","新文".repeat(90000));NoteHistory.checkpoint(n,3000);
  assertTrue(n.getJSONArray("_history").toString().getBytes(StandardCharsets.UTF_8).length<=NoteHistory.MAX_BYTES);assertEquals(2,n.getJSONArray("_history").length());
  JSONObject huge=note("中".repeat(600000),1),changed=note("新的当前正文",2);NoteHistory.beforeSave(changed,huge,1000);assertEquals("新的当前正文",changed.getString("content"));assertEquals(0,changed.getJSONArray("_history").length());
 }
 @Test public void restoringPreservesMetadataAndMakesCurrentContentRecoverable()throws Exception{
  JSONObject n=note("原文",1);NoteHistory.checkpoint(n,1000);String version=n.getJSONArray("_history").getJSONObject(0).getString("id");n.put("content","当前文").put("title","当前标题").put("favorite",true).put("folderId","5ca8e830-e9ce-44af-8916-b879a5e88981");
  JSONObject restored=NoteHistory.restore(n,version,2000);assertEquals("原文",restored.getString("content"));assertEquals("原来的标题",restored.getString("title"));assertTrue(restored.getBoolean("favorite"));assertEquals(n.getString("folderId"),restored.getString("folderId"));assertEquals("保留标签",restored.getJSONArray("tags").getString(0));assertEquals("当前文",restored.getJSONArray("_history").getJSONObject(0).getString("content"));assertEquals("当前文",n.getString("content"));
 }
 @Test public void attachmentChangesAreVersionedAndRestoredWithoutSharedMutableArrays()throws Exception{
  JSONObject n=note("正文",1).put("attachments",new JSONArray().put(new JSONObject().put("src","media/file.bin").put("name","资料.pdf").put("mime","application/pdf").put("size",100)));
  JSONObject changed=note("正文",2).put("attachments",new JSONArray());NoteHistory.beforeSave(changed,n,1000);assertEquals(1,changed.getJSONArray("_history").length());String id=changed.getJSONArray("_history").getJSONObject(0).getString("id");
  JSONObject restored=NoteHistory.restore(changed,id,2000);assertEquals("资料.pdf",restored.getJSONArray("attachments").getJSONObject(0).getString("name"));restored.getJSONArray("attachments").getJSONObject(0).put("name","改名");assertEquals("资料.pdf",changed.getJSONArray("_history").getJSONObject(0).getJSONArray("attachments").getJSONObject(0).getString("name"));
 }
 @Test public void missingVersionOrUncheckpointableCurrentNeverMutatesOriginal()throws Exception{
  JSONObject n=note("原文",1);NoteHistory.checkpoint(n,1000);String before=n.toString();try{NoteHistory.restore(n,"missing",2000);fail();}catch(IllegalArgumentException expected){}assertEquals(before,n.toString());
  String version=n.getJSONArray("_history").getJSONObject(0).getString("id");n.put("content","中".repeat(600000));before=n.toString();try{NoteHistory.restore(n,version,2000);fail();}catch(IllegalArgumentException expected){}assertEquals(before,n.toString());
 }
}
