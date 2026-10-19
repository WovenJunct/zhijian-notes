package app.zhijian.notes;

import app.zhijian.notes.data.ReminderPlan;
import java.util.Map;
import org.json.JSONArray;
import org.json.JSONObject;
import org.junit.Test;
import static org.junit.Assert.*;

public class ReminderPlanTest {
 private static final String ID="11111111-2222-4333-8444-555555555555";
 private JSONObject todo(long at)throws Exception{return new JSONObject().put("id",ID).put("title","准备资料").put("completed",false).put("deletedAt",JSONObject.NULL).put("reminderAt",at);}

 @Test public void onlyFutureActiveTodosProduceAlarms()throws Exception {
  assertEquals(Long.valueOf(2000),ReminderPlan.future(new JSONArray().put(todo(2000)),1000,new JSONObject()).get(ID));
  for(JSONObject excluded:new JSONObject[]{todo(1000),todo(999),todo(0),todo(2000).put("completed",true),todo(2000).put("deletedAt",500),todo(2000).put("id","../path"),todo(2000).put("reminderAt","2000"),todo(2000).put("reminderAt",2000.5)}){
   assertTrue(ReminderPlan.future(new JSONArray().put(excluded),1000,new JSONObject()).isEmpty());
  }
 }

 @Test public void alreadyDeliveredTimestampIsNotScheduledButChangedReminderIs()throws Exception {
  JSONObject delivered=new JSONObject().put(ID,2000);
  assertTrue(ReminderPlan.future(new JSONArray().put(todo(2000)),1000,delivered).isEmpty());
  Map<String,Long> changed=ReminderPlan.future(new JSONArray().put(todo(3000)),1000,delivered);
  assertEquals(1,changed.size());assertEquals(Long.valueOf(3000),changed.get(ID));
 }

 @Test public void delayedAlarmCanNotifyOnlyCurrentUnfinishedMatchingTodo()throws Exception {
  assertTrue(ReminderPlan.canDeliver(todo(1000),ID,1000,5000,new JSONObject()));
  assertFalse(ReminderPlan.canDeliver(todo(6000),ID,6000,5000,new JSONObject()));
  assertFalse(ReminderPlan.canDeliver(todo(2000),ID,1000,5000,new JSONObject()));
  assertFalse(ReminderPlan.canDeliver(todo(1000).put("completed",true),ID,1000,5000,new JSONObject()));
  assertFalse(ReminderPlan.canDeliver(todo(1000).put("deletedAt",2000),ID,1000,5000,new JSONObject()));
  assertFalse(ReminderPlan.canDeliver(todo(1000),"22222222-2222-4333-8444-555555555555",1000,5000,new JSONObject()));
 }

 @Test public void repeatedBroadcastCannotDeliverSameReminderTwice()throws Exception {
  assertFalse(ReminderPlan.canDeliver(todo(1000),ID,1000,5000,new JSONObject().put(ID,1000)));
  assertTrue(ReminderPlan.canDeliver(todo(2000),ID,2000,5000,new JSONObject().put(ID,1000)));
 }
 @Test public void previouslyScheduledUndeliveredAlarmIsRearmedAfterRestart()throws Exception {
  JSONArray todos=new JSONArray().put(todo(1000));JSONObject scheduled=new JSONObject().put(ID,1000);
  assertEquals(Long.valueOf(1000),ReminderPlan.pending(todos,5000,new JSONObject(),scheduled).get(ID));
  assertEquals(6000,ReminderPlan.triggerAt(1000,5000));assertEquals(9000,ReminderPlan.triggerAt(9000,5000));
  assertTrue(ReminderPlan.pending(todos,5000,new JSONObject(),new JSONObject()).isEmpty());
  assertTrue(ReminderPlan.pending(todos,5000,new JSONObject().put(ID,1000),scheduled).isEmpty());
 }
}
