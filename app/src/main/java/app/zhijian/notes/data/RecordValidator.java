package app.zhijian.notes.data;
import org.json.*;
import java.util.*;
public final class RecordValidator {
 public static String id(String s){if(!s.matches("[a-fA-F0-9]{8}(-[a-fA-F0-9]{4}){3}-[a-fA-F0-9]{12}"))throw new IllegalArgumentException("记录 ID 无效");return s;}
 public static JSONObject note(JSONObject input) throws JSONException {
  JSONObject n=new JSONObject(input.toString());id(n.getString("id"));
  String mode=n.optString("mode");if(!mode.equals("rich")&&!mode.equals("markdown"))throw new IllegalArgumentException("不支持的编辑类型");
  if(!(n.opt("title") instanceof String)||n.getString("title").length()>300)throw new IllegalArgumentException("标题最长 300 字");
  if(!(n.opt("content") instanceof String)||n.getString("content").length()>2*1024*1024)throw new IllegalArgumentException("笔记内容过大，请分成多条保存");
  JSONArray tags=n.optJSONArray("tags");LinkedHashSet<String> unique=new LinkedHashSet<>();
  if(tags!=null)for(int i=0;i<tags.length();i++){if(!(tags.get(i) instanceof String))throw new IllegalArgumentException("标签必须是文字");String t=tags.getString(i).trim();if(t.length()>40)throw new IllegalArgumentException("标签最长 40 字");if(!t.isEmpty())unique.add(t);}
  if(unique.size()>50)throw new IllegalArgumentException("每条笔记最多 50 个标签");
  n.put("tags",new JSONArray(unique));n.put("plainText",n.optString("plainText",""));
  n.put("pinned",n.optBoolean("pinned",false));n.put("favorite",n.optBoolean("favorite",false));
  JSONArray attachments=n.optJSONArray("attachments");if(n.has("attachments")&&attachments==null)throw new IllegalArgumentException("附件列表无效");if(attachments==null)attachments=new JSONArray();if(attachments.length()>50)throw new IllegalArgumentException("每条笔记最多 50 个文件附件");for(int i=0;i<attachments.length();i++){JSONObject file=attachments.getJSONObject(i);if(!file.optString("src").matches("media/[a-fA-F0-9]{8}(?:-[a-fA-F0-9]{4}){3}-[a-fA-F0-9]{12}\\.bin")||file.optString("name").isEmpty()||file.optString("name").length()>240||file.optLong("size",-1)<0||file.optLong("size")>20L*1024*1024||!file.optString("mime").matches("[a-zA-Z0-9!#$&^_.+-]+/[a-zA-Z0-9!#$&^_.+-]+"))throw new IllegalArgumentException("附件信息无效");}n.put("attachments",attachments);
  if(n.isNull("folderId")||n.optString("folderId").isEmpty())n.put("folderId",JSONObject.NULL);else id(n.getString("folderId"));
  return n;
 }
 public static JSONObject todo(JSONObject input) throws JSONException {JSONObject n=new JSONObject(input.toString());id(n.getString("id"));String title=n.optString("title").trim();if(title.isEmpty()||title.length()>500)throw new IllegalArgumentException("待办需填写 1—500 字内容");n.put("title",title);n.put("completed",n.optBoolean("completed",false));for(String key:new String[]{"dueAt","reminderAt"}){long value=n.optLong(key,0);if(value<0||value>32503680000000L)throw new IllegalArgumentException("待办日期无效");n.put(key,value);}return n;}
 public static JSONObject folder(JSONObject input) throws JSONException {JSONObject n=new JSONObject(input.toString());id(n.getString("id"));String name=n.optString("name").trim();if(name.isEmpty()||name.length()>60)throw new IllegalArgumentException("文件夹名称需填写 1—60 字");n.put("name",name);return n;}
 public static void snapshot(JSONObject n) throws JSONException {
  if(!"paper-notes".equals(n.optString("format"))||n.optInt("version")!=1)throw new IllegalArgumentException("不支持的备份格式或版本");
  Set<String> folders=new HashSet<>();JSONArray fs=n.getJSONArray("folders");for(int i=0;i<fs.length();i++)folders.add(folder(fs.getJSONObject(i)).getString("id"));
  for(String key:new String[]{"notes","todos","folders"}){JSONArray a=n.getJSONArray(key);if(a.length()>10000)throw new IllegalArgumentException("备份记录数量过多");Set<String> seen=new HashSet<>();for(int i=0;i<a.length();i++){JSONObject r=a.getJSONObject(i);if(key.equals("notes")){note(r);if(!r.isNull("folderId")&&!r.optString("folderId").isEmpty()&&!folders.contains(r.getString("folderId")))throw new IllegalArgumentException("笔记引用的文件夹缺失");}else if(key.equals("todos"))todo(r);else folder(r);if(!seen.add(r.getString("id")))throw new IllegalArgumentException("备份含重复记录 ID");}}
 }
}
