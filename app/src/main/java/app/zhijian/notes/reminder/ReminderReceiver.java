package app.zhijian.notes.reminder;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.util.Log;
import app.zhijian.notes.data.PaperDb;
import java.util.Arrays;

public final class ReminderReceiver extends BroadcastReceiver {
 @Override public void onReceive(Context context,Intent intent){
  if(intent==null)return;String action=intent.getAction();boolean alarm=ReminderScheduler.ACTION_FIRE.equals(action);
  if(!alarm&&!Arrays.asList(Intent.ACTION_BOOT_COMPLETED,Intent.ACTION_TIME_CHANGED,Intent.ACTION_TIMEZONE_CHANGED,Intent.ACTION_MY_PACKAGE_REPLACED).contains(action))return;
  PendingResult result=goAsync();
  new Thread(()->{
   try{
    if(alarm)ReminderScheduler.fire(context,intent.getStringExtra("id"),intent.getLongExtra("reminderAt",0));
    else{PaperDb db=new PaperDb(context);try{ReminderScheduler.reconcile(context,db);}finally{db.close();}}
   }catch(Exception error){Log.e("PaperReminders","本地提醒处理失败",error);}finally{result.finish();}
  },"paper-reminder").start();
 }
}
