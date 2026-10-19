package app.zhijian.notes.reminder;

import android.Manifest;
import android.app.Activity;
import android.app.AlarmManager;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.provider.Settings;
import app.zhijian.notes.MainActivity;
import app.zhijian.notes.R;
import app.zhijian.notes.data.PaperDb;
import app.zhijian.notes.data.RecordValidator;
import app.zhijian.notes.data.ReminderPlan;
import java.io.IOException;
import java.util.HashMap;
import java.util.Iterator;
import java.util.Map;
import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

public final class ReminderScheduler {
 public static final String ACTION_FIRE="app.zhijian.notes.REMIND_TODO";
 public static final String CHANNEL_ID="reminders";
 public static final int PERMISSION_REQUEST_CODE=9301;
 private static final String PREFS="paper-reminders";
 private ReminderScheduler(){}

 public static JSONObject status(Context context)throws JSONException {
  NotificationManager manager=channel(context);
  boolean permission=Build.VERSION.SDK_INT<33||context.checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS)==PackageManager.PERMISSION_GRANTED;
  NotificationChannel channel=manager==null?null:manager.getNotificationChannel(CHANNEL_ID);
  boolean enabled=permission&&manager!=null&&manager.areNotificationsEnabled()&&(channel==null||channel.getImportance()!=NotificationManager.IMPORTANCE_NONE);
  return new JSONObject().put("enabled",enabled).put("permission",permission);
 }

 public static void requestPermission(Activity activity){
  activity.runOnUiThread(()->{
   SharedPreferences prefs=activity.getSharedPreferences(PREFS,0);
   if(Build.VERSION.SDK_INT>=33&&activity.checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS)!=PackageManager.PERMISSION_GRANTED&&(!prefs.getBoolean("permissionRequested",false)||activity.shouldShowRequestPermissionRationale(Manifest.permission.POST_NOTIFICATIONS))){
    prefs.edit().putBoolean("permissionRequested",true).apply();
    activity.requestPermissions(new String[]{Manifest.permission.POST_NOTIFICATIONS},PERMISSION_REQUEST_CODE);
   }else activity.startActivity(new Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS).putExtra(Settings.EXTRA_APP_PACKAGE,activity.getPackageName()));
  });
 }

 public static synchronized void reconcile(Context context,PaperDb db)throws Exception {
  NotificationManager notifications=channel(context);AlarmManager alarms=context.getSystemService(AlarmManager.class);
  if(alarms==null||notifications==null)return;
  SharedPreferences prefs=context.getSharedPreferences(PREFS,0);
  JSONObject old=read(prefs,"scheduled"),delivered=read(prefs,"delivered");
  JSONArray todos=db.snapshot().getJSONArray("todos");Map<String,JSONObject> records=new HashMap<>();
  for(int i=0;i<todos.length();i++){JSONObject todo=todos.getJSONObject(i);records.put(todo.optString("id"),todo);}
  long now=System.currentTimeMillis();Map<String,Long> future=ReminderPlan.pending(todos,now,delivered,old);boolean enabled=status(context).getBoolean("enabled");
  if(!enabled)future.clear();
  Iterator<String> previous=old.keys();
  while(previous.hasNext()){
   String id=previous.next();if(!validId(id))continue;
   long previousAt=old.optLong(id);
   if(!future.containsKey(id)||future.get(id)!=previousAt)try{alarms.cancel(alarm(context,id,previousAt));}catch(SecurityException restricted){}
  }
  Iterator<String> seen=delivered.keys();
  while(seen.hasNext()){
   String id=seen.next();JSONObject todo=records.get(id);
   if(todo==null||todo.optBoolean("completed")||!todo.isNull("deletedAt")||todo.optLong("reminderAt")!=delivered.optLong(id))notifications.cancel("todo:"+id,1);
  }
  JSONObject scheduled=new JSONObject();
  for(Map.Entry<String,Long> reminder:future.entrySet()){
   try{
    // Inexact idle alarms avoid special exact-alarm access; the UI explains possible delay.
    alarms.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP,ReminderPlan.triggerAt(reminder.getValue(),now),alarm(context,reminder.getKey(),reminder.getValue()));
    scheduled.put(reminder.getKey(),reminder.getValue());
   }catch(SecurityException restricted){/* Keep the date; the system may disallow background alarms. */}
  }
  JSONObject retained=new JSONObject();Iterator<String> deliveredIds=delivered.keys();
  while(deliveredIds.hasNext()){String id=deliveredIds.next();if(records.containsKey(id))retained.put(id,delivered.get(id));}
  if(!prefs.edit().putString("scheduled",scheduled.toString()).putString("delivered",retained.toString()).commit())throw new IOException("提醒设置保存失败，请重试");
 }

 static synchronized void fire(Context context,String id,long at)throws Exception {
  if(!validId(id)||at<=0)return;
  PaperDb db=new PaperDb(context);
  try{
   JSONObject todo;try{todo=db.get("todos",id);}catch(IllegalArgumentException absent){return;}
   SharedPreferences prefs=context.getSharedPreferences(PREFS,0);JSONObject delivered=read(prefs,"delivered");
   if(!ReminderPlan.canDeliver(todo,id,at,System.currentTimeMillis(),delivered)||!status(context).getBoolean("enabled"))return;
   NotificationManager manager=channel(context);if(manager==null)return;
   Intent open=new Intent(context,MainActivity.class).putExtra("openTodos",true).setFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP|Intent.FLAG_ACTIVITY_SINGLE_TOP);
   PendingIntent tap=PendingIntent.getActivity(context,0,open,PendingIntent.FLAG_UPDATE_CURRENT|PendingIntent.FLAG_IMMUTABLE);
   Notification publicNotice=new Notification.Builder(context,CHANNEL_ID).setSmallIcon(R.drawable.ic_notification).setContentTitle("纸间待办提醒").setContentText("有一件待办等你完成").build();
   Bundle metadata=new Bundle();metadata.putLong("paperReminderAt",at);
   Notification notification=new Notification.Builder(context,CHANNEL_ID).setSmallIcon(R.drawable.ic_notification).setContentTitle("待办提醒").setContentText(todo.optString("title")).setStyle(new Notification.BigTextStyle().bigText(todo.optString("title"))).setContentIntent(tap).setAutoCancel(true).setOnlyAlertOnce(true).setVisibility(Notification.VISIBILITY_PRIVATE).setPublicVersion(publicNotice).setCategory(Notification.CATEGORY_REMINDER).addExtras(metadata).build();
   boolean alreadyPosted=false;
   for(android.service.notification.StatusBarNotification active:manager.getActiveNotifications())if(("todo:"+id).equals(active.getTag())&&active.getNotification().extras.getLong("paperReminderAt",0)==at)alreadyPosted=true;
   // A stable notification tag and persisted timestamp also recover a failed preference commit.
   if(!alreadyPosted)try{manager.notify("todo:"+id,1,notification);}catch(RuntimeException restricted){return;}
   delivered.put(id,at);JSONObject scheduled=read(prefs,"scheduled");scheduled.remove(id);
   if(!prefs.edit().putString("delivered",delivered.toString()).putString("scheduled",scheduled.toString()).commit())throw new IOException("提醒状态保存失败");
  }finally{db.close();}
 }

 private static PendingIntent alarm(Context context,String id,long at){
  Intent intent=new Intent(context,ReminderReceiver.class).setAction(ACTION_FIRE).setData(Uri.parse("paper-reminder://todo/"+id)).putExtra("id",id).putExtra("reminderAt",at);
  return PendingIntent.getBroadcast(context,0,intent,PendingIntent.FLAG_UPDATE_CURRENT|PendingIntent.FLAG_IMMUTABLE);
 }
 private static NotificationManager channel(Context context){
  NotificationManager manager=context.getSystemService(NotificationManager.class);
  if(manager!=null){NotificationChannel channel=new NotificationChannel(CHANNEL_ID,"待办提醒",NotificationManager.IMPORTANCE_DEFAULT);channel.setDescription("为设置了提醒的待办发送本地通知");channel.setLockscreenVisibility(Notification.VISIBILITY_PRIVATE);manager.createNotificationChannel(channel);}
  return manager;
 }
 private static JSONObject read(SharedPreferences prefs,String key){try{return new JSONObject(prefs.getString(key,"{}"));}catch(JSONException invalid){return new JSONObject();}}
 private static boolean validId(String id){if(id==null)return false;try{RecordValidator.id(id);return true;}catch(IllegalArgumentException invalid){return false;}}
}
