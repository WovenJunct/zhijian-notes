package app.zhijian.notes.data;
import org.json.*;
import java.nio.charset.StandardCharsets;
import java.util.UUID;

/** Bounded, non-recursive versions stored with each note for offline backup compatibility. */
public final class NoteHistory {
 public static final int MAX_ITEMS=12,MAX_BYTES=1536*1024;
 private static final long INTERVAL=60000;
 private NoteHistory(){}
 private static JSONArray attachments(JSONObject note)throws JSONException{return note.optJSONArray("attachments")==null?new JSONArray():new JSONArray(note.getJSONArray("attachments").toString());}
 private static boolean same(JSONObject a,JSONObject b)throws JSONException{return a.optString("title").equals(b.optString("title"))&&a.optString("content").equals(b.optString("content"))&&a.optString("mode").equals(b.optString("mode"))&&attachments(a).toString().equals(attachments(b).toString());}
 private static int size(JSONArray values){return values.toString().getBytes(StandardCharsets.UTF_8).length;}
 public static JSONArray items(JSONObject note)throws JSONException{
  JSONArray clean=new JSONArray(),source=note.optJSONArray("_history");if(source==null)return clean;
  for(int i=0;i<source.length()&&clean.length()<MAX_ITEMS;i++){
   JSONObject item=source.optJSONObject(i);if(item==null||!(item.opt("content") instanceof String)||!(item.opt("title") instanceof String))continue;
   if(item.getString("title").length()>300||item.getString("content").length()>2*1024*1024||!item.optString("mode").equals(note.optString("mode")))continue;
   String id=item.optString("id");try{RecordValidator.id(id);}catch(IllegalArgumentException ignored){continue;}
   JSONObject copy=new JSONObject().put("id",id).put("title",item.getString("title")).put("content",item.getString("content")).put("mode",item.getString("mode")).put("attachments",attachments(item)).put("updatedAt",item.optLong("updatedAt")).put("capturedAt",item.optLong("capturedAt",item.optLong("updatedAt")));
   JSONArray candidate=new JSONArray(clean.toString()).put(copy);if(size(candidate)<=MAX_BYTES)clean=candidate;
  }return clean;
 }
 private static JSONArray push(JSONArray existing,JSONObject note,long now,boolean required)throws JSONException{
  if(existing.length()>0&&same(existing.getJSONObject(0),note))return existing;
  JSONObject version=new JSONObject().put("id",UUID.randomUUID().toString()).put("title",note.optString("title")).put("content",note.optString("content")).put("mode",note.optString("mode")).put("attachments",attachments(note)).put("updatedAt",note.optLong("updatedAt",now)).put("capturedAt",now);
  JSONArray values=new JSONArray().put(version);if(size(values)>MAX_BYTES){if(required)throw new IllegalArgumentException("当前正文过大，无法保存历史版本。请先导出或拆分这条笔记。");return existing;}
  for(int i=0;i<existing.length()&&values.length()<MAX_ITEMS;i++){JSONArray candidate=new JSONArray(values.toString()).put(existing.getJSONObject(i));if(size(candidate)>MAX_BYTES)break;values=candidate;}return values;
 }
 public static void beforeSave(JSONObject next,JSONObject previous,long now)throws JSONException{
  JSONArray versions=previous==null?new JSONArray():items(previous);
  if(previous!=null&&!same(next,previous)&&(versions.length()==0||now-versions.getJSONObject(0).optLong("capturedAt")>=INTERVAL))versions=push(versions,previous,now,false);
  next.put("_history",versions);
 }
 public static void checkpoint(JSONObject note,long now)throws JSONException{note.put("_history",push(items(note),note,now,true));}
 public static JSONObject restore(JSONObject note,String versionId,long now)throws JSONException{
  JSONArray versions=items(note);JSONObject selected=null;for(int i=0;i<versions.length();i++)if(versions.getJSONObject(i).getString("id").equals(versionId)){selected=versions.getJSONObject(i);break;}
  if(selected==null)throw new IllegalArgumentException("历史版本不存在，可能已被自动清理，请刷新后重试");
  JSONObject result=new JSONObject(note.toString());checkpoint(result,now);result.put("title",selected.getString("title")).put("content",selected.getString("content")).put("attachments",attachments(selected)).put("updatedAt",now);return result;
 }
}
