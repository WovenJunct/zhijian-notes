package app.zhijian.notes.data;
import org.json.*;
import java.text.Collator;
import java.text.SimpleDateFormat;
import java.util.*;
import java.util.concurrent.ThreadLocalRandom;

/** Pure presentation queries; never change stored records or backup format. */
public final class NoteQueries {
 private NoteQueries(){}
 public static String firstLine(String value){
  for(String line:value.split("\\R")){String text=line.trim();if(!text.isEmpty()){int length=text.codePointCount(0,text.length());return length>160?text.substring(0,text.offsetByCodePoints(0,160)):text;}}
  return "";
 }
 public static JSONArray sorted(JSONArray input,String order)throws JSONException{
  if(!Arrays.asList("updated","created","oldest","title").contains(order))throw new IllegalArgumentException("不支持的排序方式");
  ArrayList<JSONObject> rows=new ArrayList<>();for(int i=0;i<input.length();i++)rows.add(input.getJSONObject(i));
  Collator titles=Collator.getInstance(Locale.CHINA);
  rows.sort((a,b)->{
   int result=Boolean.compare(b.optBoolean("pinned"),a.optBoolean("pinned"));if(result!=0)return result;
   if(order.equals("title"))result=titles.compare(a.optString("title"),b.optString("title"));
   else if(order.equals("oldest"))result=Long.compare(a.optLong("createdAt"),b.optLong("createdAt"));
   else if(order.equals("created"))result=Long.compare(b.optLong("createdAt"),a.optLong("createdAt"));
   else result=Long.compare(b.optLong("updatedAt"),a.optLong("updatedAt"));
   return result!=0?result:a.optString("id").compareTo(b.optString("id"));
  });return new JSONArray(rows);
 }
 public static boolean matches(JSONObject note,JSONObject filter){
  long from=filter.optLong("from",0),to=filter.optLong("to",0),created=note.optLong("createdAt");String mode=filter.optString("mode");
  if(from<0||to<0||(to>0&&to<=from))throw new IllegalArgumentException("日期范围无效");
  if(!mode.isEmpty()&&!mode.equals("rich")&&!mode.equals("markdown"))throw new IllegalArgumentException("不支持的编辑类型");
  return (from==0||created>=from)&&(to==0||created<to)&&(mode.isEmpty()||mode.equals(note.optString("mode")));
 }
 public static JSONObject overview(JSONArray notes)throws JSONException{
  JSONObject dates=new JSONObject();long words=0;int favorites=0;SimpleDateFormat format=new SimpleDateFormat("yyyy-MM-dd",Locale.ROOT);
  for(int i=0;i<notes.length();i++){
   JSONObject n=notes.getJSONObject(i);String date=format.format(new Date(n.optLong("createdAt")));dates.put(date,dates.optInt(date)+1);
   String text=n.optString("plainText");for(int at=0;at<text.length();){int cp=text.codePointAt(at);if(!Character.isWhitespace(cp))words++;at+=Character.charCount(cp);}
   if(n.optBoolean("favorite"))favorites++;
  }
  return new JSONObject().put("total",notes.length()).put("words",words).put("favorites",favorites).put("days",dates.length()).put("dates",dates).put("randomId",notes.length()==0?JSONObject.NULL:notes.getJSONObject(ThreadLocalRandom.current().nextInt(notes.length())).getString("id"));
 }
}
