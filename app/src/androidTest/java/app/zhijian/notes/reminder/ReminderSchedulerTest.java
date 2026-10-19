package app.zhijian.notes.reminder;

import android.app.Notification;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.SystemClock;
import android.service.notification.StatusBarNotification;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import app.zhijian.notes.data.PaperDb;
import org.json.JSONObject;
import org.junit.Test;
import org.junit.runner.RunWith;
import static org.junit.Assert.*;
import static org.junit.Assume.assumeTrue;

@RunWith(AndroidJUnit4.class)
public class ReminderSchedulerTest {
 @Test public void overdueUndeliveredScheduledReminderIsRearmedAfterRestart()throws Exception {
  Context context=InstrumentationRegistry.getInstrumentation().getTargetContext();
  assumeTrue("Enable app notifications to exercise native reminder integration",ReminderScheduler.status(context).getBoolean("enabled"));
  PaperDb db=new PaperDb(context);JSONObject original=db.snapshot();
  try{
   long at=System.currentTimeMillis()-60000;
   JSONObject todo=db.save("todos",new JSONObject().put("title","restart reminder recovery").put("completed",false).put("reminderAt",at));String id=todo.getString("id");
   JSONObject old=new JSONObject(context.getSharedPreferences("paper-reminders",0).getString("scheduled","{}"));old.put(id,at);
   assertTrue(context.getSharedPreferences("paper-reminders",0).edit().putString("scheduled",old.toString()).commit());
   Intent alarm=new Intent(context,ReminderReceiver.class).setAction(ReminderScheduler.ACTION_FIRE).setData(Uri.parse("paper-reminder://todo/"+id));
   assertNull(PendingIntent.getBroadcast(context,0,alarm,PendingIntent.FLAG_NO_CREATE|PendingIntent.FLAG_IMMUTABLE));
   ReminderScheduler.reconcile(context,db);
   assertNotNull(PendingIntent.getBroadcast(context,0,alarm,PendingIntent.FLAG_NO_CREATE|PendingIntent.FLAG_IMMUTABLE));
   assertEquals(at,new JSONObject(context.getSharedPreferences("paper-reminders",0).getString("scheduled","{}")).getLong(id));
  }finally{db.applySnapshot(original);ReminderScheduler.reconcile(context,db);db.close();}
 }
 @Test public void futureReminderIsCancelledWhenTodoCompletes()throws Exception {
  Context context=InstrumentationRegistry.getInstrumentation().getTargetContext();
  assumeTrue("Enable app notifications to exercise native reminder integration",ReminderScheduler.status(context).getBoolean("enabled"));
  PaperDb db=new PaperDb(context);JSONObject original=db.snapshot();
  try{
   long at=System.currentTimeMillis()+60000;
   JSONObject todo=db.save("todos",new JSONObject().put("title","native alarm cancellation").put("completed",false).put("reminderAt",at));
   String id=todo.getString("id");ReminderScheduler.reconcile(context,db);
   assertEquals(at,new JSONObject(context.getSharedPreferences("paper-reminders",0).getString("scheduled","{}")).getLong(id));
   db.save("todos",todo.put("completed",true));ReminderScheduler.reconcile(context,db);
   assertFalse(new JSONObject(context.getSharedPreferences("paper-reminders",0).getString("scheduled","{}")).has(id));
  }finally{db.applySnapshot(original);ReminderScheduler.reconcile(context,db);db.close();}
 }

 @Test public void delayedAlarmPostsPrivateNotificationOnceAndCompletionRemovesIt()throws Exception {
  Context context=InstrumentationRegistry.getInstrumentation().getTargetContext();
  assumeTrue("Enable app notifications to exercise native reminder integration",ReminderScheduler.status(context).getBoolean("enabled"));
  PaperDb db=new PaperDb(context);JSONObject original=db.snapshot();String id=null;
  NotificationManager manager=context.getSystemService(NotificationManager.class);
  try{
   long at=System.currentTimeMillis()-1000;
   JSONObject todo=db.save("todos",new JSONObject().put("title","原生提醒测试").put("completed",false).put("reminderAt",at));id=todo.getString("id");
   ReminderScheduler.fire(context,id,at);StatusBarNotification first=awaitNotification(manager,id,true);assertNotNull(first);
   assertEquals("原生提醒测试",first.getNotification().extras.getCharSequence(Notification.EXTRA_TEXT).toString());
   assertEquals(Notification.VISIBILITY_PRIVATE,first.getNotification().visibility);assertNotNull(first.getNotification().publicVersion);
   SystemClock.sleep(30);ReminderScheduler.fire(context,id,at);assertEquals(first.getPostTime(),find(manager,id).getPostTime());
   db.save("todos",todo.put("completed",true));ReminderScheduler.reconcile(context,db);assertNull(awaitNotification(manager,id,false));
  }finally{if(id!=null)manager.cancel("todo:"+id,1);db.applySnapshot(original);ReminderScheduler.reconcile(context,db);db.close();}
 }

 @Test public void staleOrEarlyAlarmCannotNotify()throws Exception {
  Context context=InstrumentationRegistry.getInstrumentation().getTargetContext();
  assumeTrue("Enable app notifications to exercise native reminder integration",ReminderScheduler.status(context).getBoolean("enabled"));
  PaperDb db=new PaperDb(context);JSONObject original=db.snapshot();String id=null;
  NotificationManager manager=context.getSystemService(NotificationManager.class);
  try{
   long future=System.currentTimeMillis()+60000;
   JSONObject todo=db.save("todos",new JSONObject().put("title","stale alarm guard").put("completed",false).put("reminderAt",future));id=todo.getString("id");
   ReminderScheduler.fire(context,id,future-120000);assertNull(find(manager,id));
   ReminderScheduler.fire(context,id,future);assertNull(find(manager,id));
   db.save("todos",todo.put("completed",true));ReminderScheduler.fire(context,id,future);assertNull(find(manager,id));
   ReminderScheduler.fire(context,"../invalid",future);assertNull(find(manager,id));
  }finally{if(id!=null)manager.cancel("todo:"+id,1);db.applySnapshot(original);ReminderScheduler.reconcile(context,db);db.close();}
 }
 private StatusBarNotification find(NotificationManager manager,String id){for(StatusBarNotification item:manager.getActiveNotifications())if(("todo:"+id).equals(item.getTag()))return item;return null;}
 private StatusBarNotification awaitNotification(NotificationManager manager,String id,boolean present){long end=SystemClock.uptimeMillis()+2000;StatusBarNotification found;do{found=find(manager,id);if((found!=null)==present)return found;SystemClock.sleep(20);}while(SystemClock.uptimeMillis()<end);return found;}
}
