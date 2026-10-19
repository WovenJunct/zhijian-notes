package app.zhijian.notes.data;

import java.util.LinkedHashMap;
import java.util.Map;
import org.json.JSONArray;
import org.json.JSONObject;

/** Scheduling decisions kept independent of Android alarms and notification permissions. */
public final class ReminderPlan {
 private ReminderPlan(){}
 public static Map<String,Long> future(JSONArray todos,long now,JSONObject delivered){
  Map<String,Long> plan=new LinkedHashMap<>();
  for(int i=0;i<todos.length();i++){
   JSONObject todo=todos.optJSONObject(i);if(!active(todo))continue;
   String id=todo.optString("id");long at=timestamp(todo);
   if(at>now&&delivered.optLong(id,0)!=at)plan.put(id,at);
  }
  return plan;
 }
 public static boolean canDeliver(JSONObject todo,String id,long at,long now,JSONObject delivered){
  return active(todo)&&todo.optString("id").equals(id)&&at>0&&at<=now&&timestamp(todo)==at&&delivered.optLong(id,0)!=at;
 }
 public static Map<String,Long> pending(JSONArray todos,long now,JSONObject delivered,JSONObject scheduled){
  Map<String,Long> plan=future(todos,now,delivered);
  for(int i=0;i<todos.length();i++){
   JSONObject todo=todos.optJSONObject(i);if(!active(todo))continue;
   String id=todo.optString("id");long at=timestamp(todo);
   if(at>0&&at<=now&&scheduled.optLong(id,0)==at&&delivered.optLong(id,0)!=at)plan.put(id,at);
  }
  return plan;
 }
 public static long triggerAt(long reminderAt,long now){return reminderAt>now?reminderAt:now+1000;}
 private static boolean active(JSONObject todo){
  if(todo==null||todo.optBoolean("completed")||!todo.isNull("deletedAt"))return false;
  try{RecordValidator.id(todo.optString("id"));return true;}catch(IllegalArgumentException invalid){return false;}
 }
 private static long timestamp(JSONObject todo){
  Object value=todo.opt("reminderAt");
  if(!(value instanceof Number))return 0;
  Number number=(Number)value;long at=number.longValue();
  return at>0&&number.doubleValue()==at?at:0;
 }
}
