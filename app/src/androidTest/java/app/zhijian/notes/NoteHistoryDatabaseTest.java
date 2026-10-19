package app.zhijian.notes;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import app.zhijian.notes.data.PaperDb;
import org.json.*;
import org.junit.*;
import org.junit.runner.RunWith;
import static org.junit.Assert.*;
@RunWith(AndroidJUnit4.class) public class NoteHistoryDatabaseTest {
 @Test public void largeNoteAndHistoryReadWithoutCursorWindowLimit()throws Exception{try(PaperDb db=new PaperDb(InstrumentationRegistry.getInstrumentation().getTargetContext())){String large=new String(new char[1200000]).replace('\0','a');JSONObject original=db.save("notes",new JSONObject().put("title","大笔记").put("mode","markdown").put("content",large));String id=original.getString("id");try{JSONObject changed=db.save("notes",new JSONObject(original.toString()).put("content",large+"新"));assertEquals(large+"新",db.get("notes",id).getString("content"));assertEquals(1,db.get("notes",id).getJSONArray("_history").length());assertTrue(db.execute("notes.list",new JSONObject().put("search","大笔记")).getInt("total")>=1);assertTrue(db.snapshot().getJSONArray("notes").length()>0);}finally{db.execute("notes.trash",new JSONObject().put("id",id));db.execute("notes.delete",new JSONObject().put("id",id));}}}
 @Test public void versionsPersistRestoreMetadataAndStayOutOfListSummaries()throws Exception{
  try(PaperDb db=new PaperDb(InstrumentationRegistry.getInstrumentation().getTargetContext())){
   JSONObject original=db.save("notes",new JSONObject().put("title","历史测试").put("content","# 原文\n![](media/history-only.png)").put("mode","markdown").put("tags",new JSONArray().put("学习")));
   String id=original.getString("id");try{
    JSONObject changed=new JSONObject(original.toString()).put("title","修改标题").put("content","# 新文").put("plainText","新文").put("favorite",true);db.save("notes",changed);
    JSONArray versions=db.execute("notes.history",new JSONObject().put("id",id)).getJSONArray("items");assertEquals(1,versions.length());assertTrue(versions.getJSONObject(0).getString("content").contains("media/history-only.png"));
    JSONObject summary=db.execute("notes.list",new JSONObject().put("search","修改标题")).getJSONArray("items").getJSONObject(0);assertFalse(summary.has("_history"));
    String before=db.get("notes",id).toString();try{db.execute("notes.restoreVersion",new JSONObject().put("id",id).put("versionId","missing"));fail();}catch(IllegalArgumentException expected){}assertEquals(before,db.get("notes",id).toString());
    db.execute("notes.restoreVersion",new JSONObject().put("id",id).put("versionId",versions.getJSONObject(0).getString("id")));JSONObject restored=db.get("notes",id);assertEquals(original.getString("content"),restored.getString("content"));assertTrue(restored.getBoolean("favorite"));assertEquals("学习",restored.getJSONArray("tags").getString(0));assertTrue(restored.getString("plainText").contains("原文"));assertEquals("# 新文",restored.getJSONArray("_history").getJSONObject(0).getString("content"));
    db.execute("notes.checkpoint",new JSONObject().put("id",id));assertTrue(db.execute("notes.history",new JSONObject().put("id",id)).getJSONArray("items").length()>=2);
   }finally{db.execute("notes.trash",new JSONObject().put("id",id));db.execute("notes.delete",new JSONObject().put("id",id));}
  }
 }
 @Test public void templateNotesRemainInSnapshotsAndKeepCustomFlag()throws Exception{
  try(PaperDb db=new PaperDb(InstrumentationRegistry.getInstrumentation().getTargetContext())){
   JSONObject template=db.save("notes",new JSONObject().put("title","我的复盘模板").put("content","## 收获").put("mode","markdown").put("isTemplate",true));String id=template.getString("id");try{
    assertTrue(db.get("notes",id).getBoolean("isTemplate"));boolean found=false;JSONArray notes=db.snapshot().getJSONArray("notes");for(int i=0;i<notes.length();i++)if(id.equals(notes.getJSONObject(i).getString("id"))){found=true;assertTrue(notes.getJSONObject(i).getBoolean("isTemplate"));}assertTrue(found);
   }finally{db.execute("notes.trash",new JSONObject().put("id",id));db.execute("notes.delete",new JSONObject().put("id",id));}
  }
 }
}
