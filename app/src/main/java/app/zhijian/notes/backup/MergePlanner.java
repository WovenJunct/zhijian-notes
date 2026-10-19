package app.zhijian.notes.backup;
import org.json.*;
import java.util.*;
import java.security.MessageDigest;
import java.nio.charset.StandardCharsets;
public final class MergePlanner {
 public static String canonical(Object value) throws JSONException {
  if(value instanceof JSONObject){JSONObject o=(JSONObject)value;List<String> keys=new ArrayList<>();Iterator<String> it=o.keys();while(it.hasNext())keys.add(it.next());Collections.sort(keys);StringBuilder b=new StringBuilder("{");for(String k:keys)b.append(JSONObject.quote(k)).append(':').append(canonical(o.get(k))).append(',');return b.append('}').toString();}
  if(value instanceof JSONArray){StringBuilder b=new StringBuilder("[");JSONArray a=(JSONArray)value;for(int i=0;i<a.length();i++)b.append(canonical(a.get(i))).append(',');return b.append(']').toString();}return value instanceof String?JSONObject.quote((String)value):String.valueOf(value);
 }
 private static Map<String,JSONObject> index(JSONArray a) throws JSONException {Map<String,JSONObject> m=new LinkedHashMap<>();for(int i=0;i<a.length();i++){JSONObject r=a.getJSONObject(i);m.put(r.getString("id"),r);}return m;}
 private static void remapMedia(JSONObject note,Map<String,String> map)throws JSONException{String content=note.optString("content");for(Map.Entry<String,String> entry:map.entrySet())if(!entry.getKey().equals(entry.getValue()))content=content.replace("media/"+entry.getKey(),"media/"+entry.getValue());note.put("content",content);JSONArray files=note.optJSONArray("attachments");if(files!=null)for(int i=0;i<files.length();i++){JSONObject file=files.getJSONObject(i);String src=file.optString("src");if(src.startsWith("media/")&&map.containsKey(src.substring(6)))file.put("src","media/"+map.get(src.substring(6)));}JSONArray history=note.optJSONArray("_history");if(history!=null)for(int i=0;i<history.length();i++)remapMedia(history.getJSONObject(i),map);}
 private static void remapLinks(JSONObject note,Map<String,String> map)throws JSONException{String original=note.optString("content");java.util.regex.Matcher matcher=java.util.regex.Pattern.compile("paper-note:([a-fA-F0-9-]{36})").matcher(original);StringBuffer output=new StringBuffer();while(matcher.find())matcher.appendReplacement(output,java.util.regex.Matcher.quoteReplacement("paper-note:"+map.getOrDefault(matcher.group(1),matcher.group(1))));matcher.appendTail(output);note.put("content",output.toString());JSONArray history=note.optJSONArray("_history");if(history!=null)for(int i=0;i<history.length();i++)remapLinks(history.getJSONObject(i),map);}
 private static String fingerprint(JSONObject r) throws Exception {JSONObject c=new JSONObject(r.toString());c.remove("id");c.remove("importKey");byte[] h=MessageDigest.getInstance("SHA-256").digest(canonical(c).getBytes(StandardCharsets.UTF_8));StringBuilder b=new StringBuilder();for(byte v:h)b.append(String.format(Locale.ROOT,"%02x",v));return b.toString();}
 public static JSONObject plan(JSONObject current,JSONObject incoming) throws Exception {
  JSONObject out=new JSONObject(current.toString());JSONObject media=out.optJSONObject("media");if(media==null){media=new JSONObject();out.put("media",media);}JSONObject inMedia=incoming.optJSONObject("media");Map<String,String> mediaMap=new LinkedHashMap<>();
  if(inMedia!=null){Iterator<String> it=inMedia.keys();while(it.hasNext()){String name=it.next(),dest=name;if(media.has(name)&&!media.getString(name).equals(inMedia.getString(name))){int dot=name.lastIndexOf('.');dest=UUID.nameUUIDFromBytes((name+":"+inMedia.getString(name)).getBytes(StandardCharsets.UTF_8))+name.substring(dot);if(media.has(dest)&&!media.getString(dest).equals(inMedia.getString(name)))throw new IllegalArgumentException("备份附件标识冲突");}mediaMap.put(name,dest);media.put(dest,inMedia.getString(name));}}
  Map<String,String> folderMap=new HashMap<>(),noteMap=new HashMap<>();List<JSONObject> importedNotes=new ArrayList<>();int added=0,skipped=0,conflicts=0;
  for(String type:new String[]{"folders","notes","todos"}){
   JSONArray target=out.getJSONArray(type);Map<String,JSONObject> existing=index(target);Map<String,String> imports=new HashMap<>();for(JSONObject r:existing.values())if(r.has("importKey"))imports.put(r.getString("importKey"),r.getString("id"));JSONArray source=incoming.getJSONArray(type);
   for(int i=0;i<source.length();i++){
    JSONObject original=source.getJSONObject(i),r=new JSONObject(original.toString());String oldId=r.getString("id"),key=oldId+":"+fingerprint(original);
    if(type.equals("notes")){if(folderMap.containsKey(r.optString("folderId")))r.put("folderId",folderMap.get(r.getString("folderId")));remapMedia(r,mediaMap);}
    JSONObject same=existing.get(oldId);if(imports.containsKey(key)||(same!=null&&canonical(same).equals(canonical(r)))){skipped++;String found=imports.containsKey(key)?imports.get(key):oldId;if(type.equals("folders"))folderMap.put(oldId,found);if(type.equals("notes"))noteMap.put(oldId,found);continue;}
    if(same!=null){r.put("id",UUID.randomUUID().toString());conflicts++;}else added++;if(type.equals("notes")||same!=null)r.put("importKey",key);
    if(type.equals("folders"))folderMap.put(oldId,r.getString("id"));if(type.equals("notes")){noteMap.put(oldId,r.getString("id"));importedNotes.add(r);}target.put(r);existing.put(r.getString("id"),r);imports.put(key,r.getString("id"));
   }
  }
  for(JSONObject note:importedNotes)remapLinks(note,noteMap);JSONObject map=new JSONObject();for(Map.Entry<String,String> e:mediaMap.entrySet())map.put(e.getKey(),e.getValue());out.put("mediaMap",map);out.put("importResult",new JSONObject().put("added",added).put("skipped",skipped).put("conflicts",conflicts));return out;
 }
}
