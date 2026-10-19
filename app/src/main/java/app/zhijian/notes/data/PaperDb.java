package app.zhijian.notes.data;
import android.content.*;
import android.database.Cursor;
import android.database.sqlite.*;
import org.json.*;
import java.util.*;
import android.text.Html;
import org.commonmark.parser.Parser;
import org.commonmark.renderer.text.TextContentRenderer;

public final class PaperDb extends SQLiteOpenHelper {
 public PaperDb(Context c){super(c,"paper.db",null,1);setWriteAheadLoggingEnabled(true);}
 @Override public void onCreate(SQLiteDatabase db){db.execSQL("CREATE TABLE records(kind TEXT NOT NULL,id TEXT NOT NULL,data TEXT NOT NULL,deleted INTEGER,updated INTEGER NOT NULL,pinned INTEGER DEFAULT 0,PRIMARY KEY(kind,id))");db.execSQL("CREATE INDEX records_list ON records(kind,deleted,pinned,updated)");}
 @Override public void onUpgrade(SQLiteDatabase db,int old,int next){throw new IllegalStateException("不支持的数据库升级");}
 public synchronized JSONObject get(String kind,String id) throws JSONException {RecordValidator.id(id);try(SQLiteStatement statement=getReadableDatabase().compileStatement("SELECT data FROM records WHERE kind=? AND id=?")){statement.bindString(1,kind);statement.bindString(2,id);try{return new JSONObject(statement.simpleQueryForString());}catch(SQLiteDoneException missing){throw new IllegalArgumentException("记录不存在，可能已被删除");}}}
 // Only IDs enter CursorWindow; complete notes and bounded history can exceed its row size.
 private JSONArray all(String kind,boolean trash) throws JSONException {JSONArray a=new JSONArray();try(Cursor c=getReadableDatabase().query("records",new String[]{"id"},"kind=? AND deleted IS "+(trash?"NOT NULL":"NULL"),new String[]{kind},null,null,"pinned DESC, updated DESC, id ASC")){while(c.moveToNext())a.put(get(kind,c.getString(0)));}return a;}
 private void put(String kind,JSONObject r) throws JSONException {ContentValues v=new ContentValues();v.put("kind",kind);v.put("id",r.getString("id"));v.put("data",r.toString());if(r.isNull("deletedAt"))v.putNull("deleted");else v.put("deleted",r.getLong("deletedAt"));v.put("updated",r.optLong("updatedAt",System.currentTimeMillis()));v.put("pinned",r.optBoolean("pinned")?1:0);long row=getWritableDatabase().insertWithOnConflict("records",null,v,SQLiteDatabase.CONFLICT_REPLACE);if(row==-1)throw new SQLiteException("保存失败，请检查手机可用空间后重试");}
 private JSONObject summary(JSONObject n) throws JSONException {
  JSONObject c=new JSONObject(n.toString());String text;
  if(c.optString("mode").equals("rich"))text=Html.fromHtml(c.optString("content"),Html.FROM_HTML_MODE_COMPACT).toString();
  else if(c.optString("mode").equals("markdown"))text=TextContentRenderer.builder().build().render(Parser.builder().build().parse(c.optString("content")));
  else text=c.optString("plainText",c.optString("title"));
  c.put("preview",NoteQueries.firstLine(text));c.remove("content");c.remove("plainText");c.remove("_history");return c;
 }
 public synchronized JSONObject save(String kind,JSONObject args) throws Exception {
  JSONObject n=new JSONObject(args.toString());String id=n.optString("id");boolean fresh=id.isEmpty();JSONObject old=null;if(fresh)id=UUID.randomUUID().toString();else old=get(kind,id);n.put("id",id);long now=System.currentTimeMillis();n.put("createdAt",old==null?now:old.optLong("createdAt",now));n.put("updatedAt",now);n.put("deletedAt",old==null?JSONObject.NULL:old.opt("deletedAt"));
  if(kind.equals("notes")){n=RecordValidator.note(n);if(old!=null&&!old.getString("mode").equals(n.getString("mode")))throw new IllegalArgumentException("编辑类型不能直接转换，请新建笔记");if(!n.isNull("folderId"))get("folders",n.getString("folderId"));NoteHistory.beforeSave(n,old,now);}
  else if(kind.equals("todos")){n=RecordValidator.todo(n);boolean done=n.getBoolean("completed");n.put("completedAt",done?(old!=null&&old.optBoolean("completed")?old.optLong("completedAt",now):now):JSONObject.NULL);}
  else n=RecordValidator.folder(n);
  put(kind,n);return n;
 }
 public synchronized JSONObject execute(String method,JSONObject args) throws Exception {
  String[] parts=method.split("\\.");String kind=parts[0],action=parts[1];
  if(method.equals("tags.list")){TreeSet<String> tags=new TreeSet<>();JSONArray notes=all("notes",false);for(int i=0;i<notes.length();i++){JSONArray a=notes.getJSONObject(i).optJSONArray("tags");if(a!=null)for(int j=0;j<a.length();j++)tags.add(a.getString(j));}return new JSONObject().put("items",new JSONArray(tags));}
  if(method.equals("notes.overview"))return NoteQueries.overview(all("notes",false));
  if(method.equals("notes.batch"))return batch(args);
  if(method.equals("notes.history"))return new JSONObject().put("items",NoteHistory.items(get("notes",args.getString("id"))));
  if(method.equals("notes.checkpoint")||method.equals("notes.restoreVersion"))return versionAction(method,args);
  if(method.equals("trash.list")){JSONArray a=new JSONArray();for(String k:new String[]{"notes","todos"}){JSONArray list=all(k,true);for(int i=0;i<list.length();i++)a.put(summary(list.getJSONObject(i)).put("type",k));}return new JSONObject().put("items",a);}
  if(method.equals("trash.empty")){getWritableDatabase().delete("records","deleted IS NOT NULL AND kind IN ('notes','todos')",null);return new JSONObject();}
  if(action.equals("get"))return get(kind,args.getString("id"));
  if(action.equals("save"))return save(kind,args);
  if(action.equals("list")){
   JSONArray source=all(kind,args.optBoolean("trash")),items=new JSONArray();if(kind.equals("notes"))source=NoteQueries.sorted(source,args.optString("sort","updated"));int total=0,offset=Math.max(0,args.optInt("offset")),limit=Math.min(200,Math.max(1,args.optInt("limit",50)));String search=args.optString("search").toLowerCase(Locale.ROOT),folder=args.optString("folderId"),tag=args.optString("tag");
   for(int i=0;i<source.length();i++){JSONObject r=source.getJSONObject(i);if(kind.equals("notes")){
    if(args.optBoolean("favorite")&&!r.optBoolean("favorite"))continue;
    if(!NoteQueries.matches(r,args))continue;
    if(folder.equals("__unfiled")&&!r.isNull("folderId"))continue;if(!folder.isEmpty()&&!folder.equals("__unfiled")&&!folder.equals(r.optString("folderId")))continue;
    JSONArray tags=r.optJSONArray("tags");if(!tag.isEmpty()){boolean found=false;if(tags!=null)for(int j=0;j<tags.length();j++)if(tag.equals(tags.getString(j)))found=true;if(!found)continue;}
    if(!search.isEmpty()&&!(r.optString("title")+'\n'+r.optString("plainText")+'\n'+String.valueOf(tags)).toLowerCase(Locale.ROOT).contains(search))continue;
   }if(total>=offset&&items.length()<limit)items.put(kind.equals("notes")?summary(r):r);total++;}
   return new JSONObject().put("items",items).put("total",total);
  }
  JSONObject r=get(kind,args.getString("id"));
  if(action.equals("delete")){
   if(kind.equals("folders")){SQLiteDatabase db=getWritableDatabase();db.beginTransaction();try{for(boolean trash:new boolean[]{false,true}){JSONArray a=all("notes",trash);for(int i=0;i<a.length();i++){JSONObject n=a.getJSONObject(i);if(r.getString("id").equals(n.optString("folderId")))put("notes",n.put("folderId",JSONObject.NULL));}}db.delete("records","kind=? AND id=?",new String[]{kind,r.getString("id")});db.setTransactionSuccessful();}finally{db.endTransaction();}}
   else {if(r.isNull("deletedAt"))throw new IllegalArgumentException("请先移入回收站");getWritableDatabase().delete("records","kind=? AND id=?",new String[]{kind,r.getString("id")});}
  }else if(action.equals("trash")||action.equals("restore")){r.put("deletedAt",action.equals("trash")?System.currentTimeMillis():JSONObject.NULL);put(kind,r);}else throw new IllegalArgumentException("不支持的操作");return new JSONObject();
 }
 private JSONObject versionAction(String method,JSONObject args)throws Exception{
  SQLiteDatabase db=getWritableDatabase();db.beginTransaction();try{
   JSONObject note=get("notes",args.getString("id"));if(!note.isNull("deletedAt"))throw new IllegalArgumentException("请先从回收站恢复这条笔记");
   long now=System.currentTimeMillis();if(method.equals("notes.checkpoint")){NoteHistory.checkpoint(note,now);put("notes",note);db.setTransactionSuccessful();return new JSONObject().put("items",NoteHistory.items(note));}
   JSONObject restored=NoteHistory.restore(note,args.getString("versionId"),now);String content=restored.getString("content");
   restored.put("plainText",restored.getString("mode").equals("rich")?Html.fromHtml(content,Html.FROM_HTML_MODE_COMPACT).toString():TextContentRenderer.builder().build().render(Parser.builder().build().parse(content)));
   restored=RecordValidator.note(restored);put("notes",restored);db.setTransactionSuccessful();return restored;
  }finally{db.endTransaction();}
 }
 private JSONObject batch(JSONObject args)throws Exception{
  JSONArray ids=args.getJSONArray("ids");String action=args.getString("action");if(ids.length()<1||ids.length()>1000)throw new IllegalArgumentException("每次请选择 1—1000 条笔记");
  if(!Arrays.asList("trash","restore","move","favorite").contains(action))throw new IllegalArgumentException("不支持的批量操作");
  String folder=args.optString("folderId");if(action.equals("move")&&!folder.isEmpty())get("folders",folder);
  SQLiteDatabase db=getWritableDatabase();db.beginTransaction();try{HashSet<String> seen=new HashSet<>();for(int i=0;i<ids.length();i++){
   String id=ids.getString(i);if(!seen.add(id))continue;JSONObject note=get("notes",id);boolean deleted=!note.isNull("deletedAt");
   if(action.equals("restore")){note.put("deletedAt",JSONObject.NULL);}
   else{if(deleted)throw new IllegalArgumentException("所选笔记已在回收站，请刷新后重试");if(action.equals("trash"))note.put("deletedAt",System.currentTimeMillis());else if(action.equals("move"))note.put("folderId",folder.isEmpty()?JSONObject.NULL:folder);else note.put("favorite",true);}
   put("notes",note);
  }db.setTransactionSuccessful();}finally{db.endTransaction();}return new JSONObject().put("count",ids.length());
 }
 public synchronized JSONObject snapshot() throws JSONException {JSONObject s=new JSONObject().put("format","paper-notes").put("version",1);for(String kind:new String[]{"notes","todos","folders"}){JSONArray a=all(kind,false),trash=all(kind,true);for(int i=0;i<trash.length();i++)a.put(trash.get(i));s.put(kind,a);}return s;}
 public synchronized void applySnapshot(JSONObject s) throws Exception {RecordValidator.snapshot(s);SQLiteDatabase db=getWritableDatabase();db.beginTransaction();try{db.delete("records",null,null);for(String kind:new String[]{"folders","notes","todos"}){JSONArray a=s.getJSONArray(kind);for(int i=0;i<a.length();i++){JSONObject n=a.getJSONObject(i);if(kind.equals("notes")){n=RecordValidator.note(n);n.put("_history",NoteHistory.items(n));}else if(kind.equals("todos"))n=RecordValidator.todo(n);else n=RecordValidator.folder(n);put(kind,n);}}db.setTransactionSuccessful();}finally{db.endTransaction();}}
}
