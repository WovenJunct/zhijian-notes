package app.zhijian.notes;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import app.zhijian.notes.data.PaperDb;
import org.json.*;import org.junit.*;import org.junit.runner.RunWith;
import static org.junit.Assert.*;
@RunWith(AndroidJUnit4.class) public class DatabaseTest {
 @Test public void legacyRichAndMarkdownSummariesUseOnlyFirstLine()throws Exception{
  PaperDb db=new PaperDb(InstrumentationRegistry.getInstrumentation().getTargetContext());
  for(String mode:new String[]{"rich","markdown"}){
   String content=mode.equals("rich")?"<p>第一行 &amp; 内容</p><p>第二段不应混入</p>":"# 第一行 &amp; 内容\n\n第二段不应混入";
   JSONObject note=db.save("notes",new JSONObject().put("title","旧版本摘要-"+mode).put("content",content).put("plainText","第一行 & 内容第二段不应混入").put("mode",mode));
   JSONArray list=db.execute("notes.list",new JSONObject().put("search","旧版本摘要-"+mode)).getJSONArray("items");assertEquals("第一行 & 内容",list.getJSONObject(0).getString("preview"));
   db.execute("notes.trash",new JSONObject().put("id",note.getString("id")));assertEquals(content,db.get("notes",note.getString("id")).getString("content"));db.execute("notes.delete",new JSONObject().put("id",note.getString("id")));
  }db.close();
 }
 @Test public void persistsSearchesAndRecoversNotes() throws Exception {
  PaperDb db=new PaperDb(InstrumentationRegistry.getInstrumentation().getTargetContext());
  JSONObject folder=db.save("folders",new JSONObject().put("name","测试文件夹"));
  JSONObject n=db.save("notes",new JSONObject().put("title","中文测试").put("content","你好世界").put("plainText","你好世界").put("mode","markdown").put("folderId",folder.getString("id")).put("tags",new JSONArray().put("测试")));
  String id=n.getString("id");db.close();db=new PaperDb(InstrumentationRegistry.getInstrumentation().getTargetContext());assertEquals("你好世界",db.get("notes",id).getString("content"));
  assertTrue(db.execute("notes.list",new JSONObject().put("search","你好")).getInt("total")>0);
  db.execute("folders.delete",new JSONObject().put("id",folder.getString("id")));assertTrue(db.get("notes",id).isNull("folderId"));
  db.execute("notes.trash",new JSONObject().put("id",id));assertFalse(db.get("notes",id).isNull("deletedAt"));db.execute("notes.restore",new JSONObject().put("id",id));assertTrue(db.get("notes",id).isNull("deletedAt"));
  db.execute("notes.trash",new JSONObject().put("id",id));db.execute("notes.delete",new JSONObject().put("id",id));db.close();
 }
}
