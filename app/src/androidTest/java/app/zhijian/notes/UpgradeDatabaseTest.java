package app.zhijian.notes;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import app.zhijian.notes.data.PaperDb;
import org.json.*;import org.junit.*;import org.junit.runner.RunWith;import static org.junit.Assert.*;
@RunWith(AndroidJUnit4.class) public class UpgradeDatabaseTest {
 @Test public void batchMoveAndTrashAreAtomicAndRestoreKeepsOriginalContent()throws Exception{
  PaperDb db=new PaperDb(InstrumentationRegistry.getInstrumentation().getTargetContext());
  JSONObject one=db.save("notes",note("整理第一条")),two=db.save("notes",note("整理第二条")),folder=db.save("folders",new JSONObject().put("name","整理测试"));JSONArray ids=new JSONArray().put(one.getString("id")).put(two.getString("id"));
  long created=one.getLong("createdAt");db.execute("notes.batch",new JSONObject().put("ids",ids).put("action","move").put("folderId",folder.getString("id")));
  assertEquals(folder.getString("id"),db.get("notes",one.getString("id")).getString("folderId"));assertEquals(created,db.get("notes",one.getString("id")).getLong("createdAt"));
  try{db.execute("notes.batch",new JSONObject().put("ids",new JSONArray().put(one.getString("id")).put("00000000-0000-0000-0000-000000000000")).put("action","trash"));fail("should reject missing record");}catch(IllegalArgumentException expected){}
  assertTrue(db.get("notes",one.getString("id")).isNull("deletedAt"));
  db.execute("notes.batch",new JSONObject().put("ids",ids).put("action","trash"));assertFalse(db.get("notes",two.getString("id")).isNull("deletedAt"));
  db.execute("notes.batch",new JSONObject().put("ids",ids).put("action","restore"));assertEquals("第一行\n第二行",db.get("notes",one.getString("id")).getString("content"));assertTrue(db.get("notes",two.getString("id")).isNull("deletedAt"));
  assertEquals(2,db.execute("notes.list",new JSONObject().put("folderId",folder.getString("id")).put("sort","title")).getInt("total"));
  db.execute("notes.batch",new JSONObject().put("ids",ids).put("action","trash"));for(int i=0;i<ids.length();i++)db.execute("notes.delete",new JSONObject().put("id",ids.getString(i)));db.execute("folders.delete",new JSONObject().put("id",folder.getString("id")));db.close();
 }
 private JSONObject note(String title)throws Exception{return new JSONObject().put("title",title).put("content","第一行\n第二行").put("plainText","第一行\n第二行").put("mode","markdown");}
}
